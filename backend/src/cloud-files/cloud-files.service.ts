import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { R2ClientService } from '../storage/r2-client.service';
import { EXCLUDE_ADMIN_USER_WHERE } from '../common/exclude-admin-user.filter';

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

  async listFiles(providerId: string, subPrefix?: string): Promise<CloudFileRow[]> {
    const objects = await this.r2Client.listObjects(providerId, subPrefix);
    if (objects.length === 0) return [];

    const keys = objects.map((o) => o.key);
    const links = await this.prisma.downloadLink.findMany({
      where: { storageProviderId: providerId, objectKey: { in: keys } },
      select: { id: true, objectKey: true, priceP: true, post: { select: { title: true } } },
    });
    const linkIds = links.map((l) => l.id);

    // Loại lượt của user có role Admin khỏi cả "member tải", "doanh thu" (tính từ số grant) lẫn
    // "lượt tải" — Admin tự tải để test/duyệt bài không phải khách hàng thật.
    const [grants, eventCounts] = linkIds.length
      ? await Promise.all([
          this.prisma.downloadGrant.findMany({
            where: { downloadLinkId: { in: linkIds }, ...EXCLUDE_ADMIN_USER_WHERE },
            select: { downloadLinkId: true, user: { select: { displayName: true } } },
          }),
          this.prisma.downloadEvent.groupBy({
            by: ['downloadLinkId'],
            where: { downloadLinkId: { in: linkIds }, ...EXCLUDE_ADMIN_USER_WHERE },
            _count: { _all: true },
          }),
        ])
      : [[], []];

    const eventCountByLinkId = new Map(eventCounts.map((e) => [e.downloadLinkId, e._count._all]));
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
