import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { R2ClientService } from '../storage/r2-client.service';
import { EXCLUDE_ADMIN_USER_WHERE } from '../common/exclude-admin-user.filter';
import { BACKUP_OBJECT_KEY_PREFIX } from '../db-backup/backup-config.types';

export interface CloudFileRow {
  key: string;
  sizeBytes: number;
  lastModified: Date | null;
  downloadCount: number;
  memberNames: string[];
  revenueP: number;
  linkedPostTitles: string[];
}

// Đối chiếu file thật trong bucket (R2ClientService.listObjects) với cấu hình DownloadLink/lượt
// tải đã ghi nhận trong DB — phục vụ trang Quản lý File Cloud (Admin xem tương tự v1 cũ).
@Injectable()
export class CloudFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Client: R2ClientService,
  ) {}

  async listFiles(
    providerId: string,
    subPrefix?: string,
  ): Promise<CloudFileRow[]> {
    // Bỏ qua file backup DB (backups/db-*.sql.gz, xem db-backup.service.ts runBackup()) — trang này
    // dành cho file NGƯỜI DÙNG tải (đối chiếu lượt tải/doanh thu), không phải nơi quản lý backup hệ
    // thống (đã có trang riêng Cài đặt > Backup DB).
    const objects = (
      await this.r2Client.listObjects(providerId, subPrefix)
    ).filter((o) => !o.key.startsWith(BACKUP_OBJECT_KEY_PREFIX));
    if (objects.length === 0) return [];

    const keys = objects.map((o) => o.key);
    const links = await this.prisma.downloadLink.findMany({
      where: { storageProviderId: providerId, objectKey: { in: keys } },
      select: {
        id: true,
        objectKey: true,
        priceP: true,
        post: { select: { title: true } },
      },
    });
    const linkIds = links.map((l) => l.id);

    // Loại lượt của user có role Admin khỏi cả "member tải", "doanh thu" (tính từ số grant) lẫn
    // "lượt tải" — Admin tự tải để test/duyệt bài không phải khách hàng thật.
    const [grants, eventCounts] = linkIds.length
      ? await Promise.all([
          this.prisma.downloadGrant.findMany({
            where: {
              downloadLinkId: { in: linkIds },
              ...EXCLUDE_ADMIN_USER_WHERE,
            },
            select: {
              downloadLinkId: true,
              user: { select: { displayName: true } },
            },
          }),
          this.prisma.downloadEvent.groupBy({
            by: ['downloadLinkId'],
            where: {
              downloadLinkId: { in: linkIds },
              ...EXCLUDE_ADMIN_USER_WHERE,
            },
            _count: { _all: true },
          }),
        ])
      : [[], []];

    const eventCountByLinkId = new Map(
      eventCounts.map((e) => [e.downloadLinkId, e._count._all]),
    );
    const grantsByLinkId = new Map<string, { displayName: string }[]>();
    for (const g of grants) {
      const arr = grantsByLinkId.get(g.downloadLinkId) ?? [];
      arr.push(g.user);
      grantsByLinkId.set(g.downloadLinkId, arr);
    }
    const linksByKey = new Map<string, typeof links>();
    for (const link of links) {
      const arr = linksByKey.get(link.objectKey) ?? [];
      arr.push(link);
      linksByKey.set(link.objectKey, arr);
    }

    return objects.map((obj) => {
      const matchedLinks = linksByKey.get(obj.key) ?? [];
      let downloadCount = 0;
      let revenueP = 0;
      const memberNames = new Set<string>();
      const linkedPostTitles: string[] = [];
      for (const link of matchedLinks) {
        downloadCount += eventCountByLinkId.get(link.id) ?? 0;
        const grantsForLink = grantsByLinkId.get(link.id) ?? [];
        revenueP += grantsForLink.length * link.priceP;
        for (const g of grantsForLink) memberNames.add(g.displayName);
        linkedPostTitles.push(link.post.title);
      }
      return {
        key: obj.key,
        sizeBytes: obj.sizeBytes,
        lastModified: obj.lastModified,
        downloadCount,
        memberNames: [...memberNames],
        revenueP,
        linkedPostTitles,
      };
    });
  }

  // Sinh presigned PUT URL cho trang "Upload File Cloud" — trình duyệt tự PUT thẳng lên bucket,
  // backend chỉ ký URL (không đụng vào nội dung file, xem r2-client.service.ts getPresignedUploadUrl).
  // Key trả về theo đúng định dạng "unprefixed" như DownloadLink.objectKey/listFiles() nên copy
  // thẳng vào ô "Object Key" ở form gắn link tải trong bài viết là dùng được ngay.
  async presignUpload(
    providerId: string,
    filename: string,
    folder?: string,
  ): Promise<{ url: string; key: string }> {
    const key = this.buildUploadKey(filename, folder);
    const url = await this.r2Client.getPresignedUploadUrl(providerId, key);
    return { url, key };
  }

  // ───────── Multipart (file > 5GB — trần cứng của PUT đơn, xem r2-client.service.ts) ─────────

  async initMultipartUpload(
    providerId: string,
    filename: string,
    folder?: string,
    contentType?: string,
  ): Promise<{ key: string; uploadId: string }> {
    const key = this.buildUploadKey(filename, folder);
    const uploadId = await this.r2Client.createMultipartUpload(
      providerId,
      key,
      contentType,
    );
    return { key, uploadId };
  }

  async presignUploadPart(
    providerId: string,
    key: string,
    uploadId: string,
    partNumber: number,
  ): Promise<{ url: string }> {
    const url = await this.r2Client.getPresignedUploadPartUrl(
      providerId,
      key,
      uploadId,
      partNumber,
    );
    return { url };
  }

  async completeMultipartUpload(
    providerId: string,
    key: string,
    uploadId: string,
    parts: { partNumber: number; eTag: string }[],
  ): Promise<void> {
    await this.r2Client.completeMultipartUpload(
      providerId,
      key,
      uploadId,
      parts,
    );
  }

  async abortMultipartUpload(
    providerId: string,
    key: string,
    uploadId: string,
  ): Promise<void> {
    await this.r2Client.abortMultipartUpload(providerId, key, uploadId);
  }

  // Không tái dùng slugify() (bỏ hết dấu chấm — mất luôn phần đuôi file ".zip"/".apk"). Giữ nguyên
  // ký tự an toàn, thay phần còn lại bằng "-". Trước đó regex cuối chỉ cho [a-zA-Z0-9._-] (thuần
  // ASCII) nên xoá mất mọi chữ Hán/CJK trong tên file gốc (yêu cầu thực tế: phải giữ nguyên đoạn
  // tiếng Hoa) — đổi sang \p{L}/\p{N} (Unicode letter/number) để giữ chữ Hán, Nhật, Hàn... Vẫn xoá
  // dấu tiếng Việt như cũ (NFD + bỏ combining marks + đ/Đ chạy TRƯỚC bước này) vì bản thân bước
  // NFD không tách được dấu ra khỏi ký tự CJK (không có gì để tách), nên không ảnh hưởng CJK.
  private sanitizeSegment(input: string): string {
    return input
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .trim()
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/-+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '');
  }

  // Bỏ trống "Thư mục con" -> upload thẳng gốc bucket (theo đúng uploadPrefix đã cấu hình ở Storage
  // Provider — R2ClientService tự cộng thêm uploadPrefix khi ghép key thật, xem toBucketKey()),
  // KHÔNG tự chèn thêm "cloud-uploads/yyyy/mm/dd/" như trước. Tên file cũng giữ nguyên (chỉ sanitize
  // ký tự không an toàn), KHÔNG tự chèn timestamp+random — đổi theo yêu cầu thực tế 2026-08-06: 2 lần
  // upload trùng tên sẽ ghi đè nhau (PUT lên S3/R2 vốn overwrite-by-key), đây là đánh đổi có chủ đích
  // để giữ tên file sạch, người dùng tự chịu trách nhiệm đặt tên/thư mục không trùng nếu cần giữ cả 2.
  private buildUploadKey(filename: string, folder?: string): string {
    const safeName = this.sanitizeSegment(filename) || 'file';

    if (folder?.trim()) {
      const safeFolder = folder
        .split('/')
        .map((seg) => this.sanitizeSegment(seg))
        .filter(Boolean)
        .join('/');
      if (safeFolder) return `${safeFolder}/${safeName}`;
    }

    return safeName;
  }

  // Chặn xoá nếu file đang gắn với 1 DownloadLink nào đó — tránh xoá nhầm file đang bán, buộc
  // Admin gỡ cấu hình download link trước (quyết định tường minh, không tự động).
  async deleteFile(providerId: string, key: string): Promise<void> {
    const inUse = await this.prisma.downloadLink.count({
      where: { storageProviderId: providerId, objectKey: key },
    });
    if (inUse > 0) {
      throw new BadRequestException(
        `Không thể xoá — đang có ${inUse} link tải sử dụng file này. Gỡ cấu hình download link (Download Config trong bài viết) trước khi xoá.`,
      );
    }
    await this.r2Client.deleteObject(providerId, key);
  }
}
