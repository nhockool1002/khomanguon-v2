import { spawn } from 'node:child_process';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DbBackupStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2ClientService } from '../storage/r2-client.service';
import { UpdateBackupConfigDto } from './dto/update-backup-config.dto';
import {
  BACKUP_OBJECT_KEY_PREFIX,
  BACKUP_SETTING_KEY,
  DEFAULT_BACKUP_CONFIG,
  type BackupConfig,
} from './backup-config.types';

const gzipAsync = promisify(gzip);

function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toPublicRecord<T extends { sizeBytes: bigint | null }>(record: T) {
  return {
    ...record,
    sizeBytes: record.sizeBytes === null ? null : Number(record.sizeBytes),
  };
}

// Backup toàn bộ DB Postgres qua pg_dump (binary cài thêm ở backend/Dockerfile — xem
// postgresql16-client), nén gzip, upload lên bucket qua R2ClientService.putObject() có sẵn — không
// cần thêm SDK/thư viện nén riêng (zlib là builtin Node). Chạy pg_dump nhắm thẳng container
// "postgres" qua DATABASE_URL (cùng docker-compose network), KHÔNG chạy trên chính container backend.
@Injectable()
export class DbBackupService {
  private readonly logger = new Logger(DbBackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly r2Client: R2ClientService,
  ) {}

  async getConfig(): Promise<BackupConfig> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: BACKUP_SETTING_KEY },
    });
    if (!row) return DEFAULT_BACKUP_CONFIG;
    return {
      ...DEFAULT_BACKUP_CONFIG,
      ...(row.value as Partial<BackupConfig>),
    };
  }

  async updateConfig(dto: UpdateBackupConfigDto): Promise<BackupConfig> {
    const next: BackupConfig = {
      enabled: dto.enabled,
      hour: dto.hour,
      minute: dto.minute,
      retentionCount: dto.retentionCount,
      storageProviderId: dto.storageProviderId ?? null,
    };
    await this.prisma.siteSetting.upsert({
      where: { key: BACKUP_SETTING_KEY },
      update: { value: toJsonValue(next) },
      create: { key: BACKUP_SETTING_KEY, value: toJsonValue(next) },
    });
    return next;
  }

  async listRecords(page: number, limit: number) {
    const take = Math.min(Math.max(limit, 1), 50);
    const skip = (Math.max(page, 1) - 1) * take;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.dbBackupRecord.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.dbBackupRecord.count(),
    ]);
    return { items: items.map(toPublicRecord), total };
  }

  async getDownloadUrl(recordId: string): Promise<{ url: string }> {
    const record = await this.prisma.dbBackupRecord.findUnique({
      where: { id: recordId },
    });
    if (!record || !record.objectKey || !record.storageProviderId) {
      throw new NotFoundException('Không tìm thấy file backup');
    }
    const url = await this.r2Client.getPresignedDownloadUrl(
      record.storageProviderId,
      record.objectKey,
    );
    return { url };
  }

  // Xoá tay 1 bản backup từ Lịch sử — cùng logic best-effort với applyRetention() (object bucket
  // xoá trước, lỗi không chặn xoá record DB, vì record đằng nào cũng không dùng lại được nếu file
  // trên bucket đã mất).
  async deleteRecord(recordId: string): Promise<{ id: string }> {
    const record = await this.prisma.dbBackupRecord.findUnique({
      where: { id: recordId },
    });
    if (!record) throw new NotFoundException('Không tìm thấy bản backup');

    if (record.objectKey && record.storageProviderId) {
      await this.r2Client
        .deleteObject(record.storageProviderId, record.objectKey)
        .catch(() => {});
    }
    await this.prisma.dbBackupRecord.delete({ where: { id: recordId } });
    return { id: recordId };
  }

  async hasRunToday(): Promise<boolean> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const count = await this.prisma.dbBackupRecord.count({
      where: { createdAt: { gte: startOfDay } },
    });
    return count > 0;
  }

  // Luôn ghi lại 1 DbBackupRecord dù thành công hay thất bại — backup lỗi âm thầm mà không ai biết
  // còn nguy hiểm hơn không có backup (tưởng an toàn nhưng thật ra không có bản nào dùng được).
  async runBackup() {
    const config = await this.getConfig();
    if (!config.storageProviderId) {
      return this.recordFailure(
        'Chưa chọn Storage Provider để lưu file backup — vào Cài đặt Backup DB để cấu hình.',
      );
    }

    try {
      const dump = await this.dumpDatabase();
      const compressed = await gzipAsync(dump);
      const objectKey = `${BACKUP_OBJECT_KEY_PREFIX}db-${new Date().toISOString().replace(/[:.]/g, '-')}.sql.gz`;
      await this.r2Client.putObject(
        config.storageProviderId,
        objectKey,
        compressed,
        'application/gzip',
      );
      const record = await this.prisma.dbBackupRecord.create({
        data: {
          status: DbBackupStatus.SUCCESS,
          sizeBytes: BigInt(compressed.length),
          storageProviderId: config.storageProviderId,
          objectKey,
        },
      });
      await this.applyRetention(
        config.retentionCount,
        config.storageProviderId,
      );
      return toPublicRecord(record);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Backup DB thất bại: ${message}`);
      return this.recordFailure(message);
    }
  }

  private async recordFailure(message: string) {
    const record = await this.prisma.dbBackupRecord.create({
      data: { status: DbBackupStatus.FAILED, errorMessage: message },
    });
    return toPublicRecord(record);
  }

  // Xoá bản SUCCESS cũ hơn retentionCount (cả object trên bucket lẫn record DB) — best-effort, lỗi
  // xoá bucket không chặn luồng chính (backup mới vẫn đã lưu thành công).
  private async applyRetention(
    retentionCount: number,
    storageProviderId: string,
  ): Promise<void> {
    const stale = await this.prisma.dbBackupRecord.findMany({
      where: { status: DbBackupStatus.SUCCESS },
      orderBy: { createdAt: 'desc' },
      skip: retentionCount,
    });
    for (const record of stale) {
      if (record.objectKey) {
        await this.r2Client
          .deleteObject(storageProviderId, record.objectKey)
          .catch(() => {});
      }
      await this.prisma.dbBackupRecord
        .delete({ where: { id: record.id } })
        .catch(() => {});
    }
  }

  private dumpDatabase(): Promise<Buffer> {
    const databaseUrl = this.config.get<string>('DATABASE_URL');
    if (!databaseUrl) throw new Error('Thiếu biến môi trường DATABASE_URL');
    const url = new URL(databaseUrl);
    const database = decodeURIComponent(url.pathname.replace(/^\//, ''));

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];
      const child = spawn(
        'pg_dump',
        [
          '--host',
          url.hostname,
          '--port',
          url.port || '5432',
          '--username',
          decodeURIComponent(url.username),
          '--format',
          'plain',
          '--no-owner',
          '--no-privileges',
          database,
        ],
        {
          env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
        },
      );
      child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `pg_dump thoát mã ${code}: ${Buffer.concat(errChunks).toString('utf8').slice(0, 500)}`,
            ),
          );
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });
  }
}
