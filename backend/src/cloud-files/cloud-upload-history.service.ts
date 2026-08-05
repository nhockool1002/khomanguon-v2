import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCloudUploadRecordDto } from './dto/create-cloud-upload-record.dto';

function toPublicRecord<T extends { sizeBytes: bigint | null }>(record: T) {
  return {
    ...record,
    sizeBytes: record.sizeBytes === null ? null : Number(record.sizeBytes),
  };
}

// Lịch sử upload — ghi 1 bản ghi mỗi khi 1 item trong hàng đợi (frontend/src/context/
// upload-queue-context.tsx) đạt trạng thái cuối (success/error/cancelled). Tách khỏi
// CloudFilesService vì khác domain rõ ràng (đó là thao tác bucket thật, đây chỉ là nhật ký) — cùng
// lý do đã tách DbBackupService làm module riêng thay vì gộp vào StorageProvidersService.
@Injectable()
export class CloudUploadHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(uploadedById: string, dto: CreateCloudUploadRecordDto) {
    // Snapshot tên provider NGAY lúc ghi — provider có thể bị xoá/đổi tên sau, lịch sử cũ vẫn đọc
    // được tên đã dùng lúc đó (cùng lý do DbBackupRecord không FK cứng tới StorageProvider).
    const providerLabel = dto.storageProviderId
      ? ((
          await this.prisma.storageProvider.findUnique({
            where: { id: dto.storageProviderId },
            select: { label: true },
          })
        )?.label ?? null)
      : null;

    const record = await this.prisma.cloudUploadRecord.create({
      data: {
        fileName: dto.fileName,
        objectKey: dto.objectKey,
        folder: dto.folder,
        sizeBytes:
          dto.sizeBytes !== undefined ? BigInt(dto.sizeBytes) : undefined,
        status: dto.status,
        errorMessage: dto.errorMessage,
        storageProviderId: dto.storageProviderId,
        providerLabel,
        uploadedById,
      },
    });
    return toPublicRecord(record);
  }

  async list(page: number, limit: number) {
    const take = Math.min(Math.max(limit, 1), 50);
    const skip = (Math.max(page, 1) - 1) * take;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cloudUploadRecord.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { uploadedBy: { select: { id: true, displayName: true } } },
      }),
      this.prisma.cloudUploadRecord.count(),
    ]);
    return { items: items.map(toPublicRecord), total };
  }
}
