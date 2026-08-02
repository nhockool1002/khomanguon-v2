import { encryptSecret } from '../../../src/common/secret-crypto.util';
import { decodeWpEntities } from '../wp-content';
import type { MigrationContext } from '../context';

const LEGACY_PROVIDER_LABEL = 'Legacy R2 (migrated)';

// Provider placeholder — chưa có Access Key/Secret thật (bạn tự nhập qua Admin > Cài đặt Storage
// sau khi review, xem Phần 3 kế hoạch). Tạo isDefault: false để không vô tình được chọn cho upload mới.
async function ensureLegacyProvider(ctx: MigrationContext): Promise<string> {
  const existing = await ctx.prisma.storageProvider.findFirst({ where: { label: LEGACY_PROVIDER_LABEL } });
  if (existing) return existing.id;
  if (ctx.dryRun) return 'dryrun:legacy-provider';

  const created = await ctx.prisma.storageProvider.create({
    data: {
      type: 'R2',
      label: LEGACY_PROVIDER_LABEL,
      bucket: 'khomanguon',
      accessKeyId: 'CHANGE_ME',
      secretAccessKeyEncrypted: encryptSecret('CHANGE_ME'),
      isDefault: false,
    },
  });
  return created.id;
}

export async function migrateDownloadLinks(ctx: MigrationContext): Promise<Map<number, string>> {
  const summary = ctx.report.startStep('download-links');
  const postIdToDownloadLinkId = new Map<number, string>();

  const [keyMeta, cashMeta, wpPosts] = await Promise.all([
    ctx.wp.postMetaByKey('custom_key'),
    ctx.wp.postMetaByKey('custom_cash'),
    ctx.wp.posts('post'),
  ]);
  summary.read = keyMeta.length;

  const cashByPostId = new Map(cashMeta.map((m) => [m.post_id, Number(m.meta_value) || 0]));
  const titleByPostId = new Map(wpPosts.map((p) => [p.ID, decodeWpEntities(p.post_title)]));
  const providerId = await ensureLegacyProvider(ctx);

  for (const meta of keyMeta) {
    const objectKey = meta.meta_value.trim();
    if (!objectKey) continue;

    const newPostId = ctx.maps.postIdToNewId.get(meta.post_id);
    if (!newPostId) {
      summary.errors.push({ ref: `download-link cho WP post#${meta.post_id}`, message: 'Post chưa được migrate (xem lỗi ở bước posts)' });
      continue;
    }

    try {
      const priceP = cashByPostId.get(meta.post_id) ?? 0;
      const label = titleByPostId.get(meta.post_id) ?? objectKey;

      if (ctx.dryRun) {
        postIdToDownloadLinkId.set(meta.post_id, `dryrun:${meta.post_id}`);
        summary.created++;
        continue;
      }

      const existing = await ctx.prisma.downloadLink.findFirst({
        where: { postId: newPostId },
        orderBy: { createdAt: 'asc' },
      });
      const data = { label, storageProviderId: providerId, objectKey, priceP };
      const link = existing
        ? await ctx.prisma.downloadLink.update({ where: { id: existing.id }, data })
        : await ctx.prisma.downloadLink.create({ data: { postId: newPostId, ...data } });
      existing ? summary.updated++ : summary.created++;

      postIdToDownloadLinkId.set(meta.post_id, link.id);
    } catch (err) {
      summary.errors.push({ ref: `download-link cho WP post#${meta.post_id}`, message: (err as Error).message });
    }
  }

  return postIdToDownloadLinkId;
}

export async function migrateDownloadEvents(
  ctx: MigrationContext,
  postIdToDownloadLinkId: Map<number, string>,
): Promise<void> {
  const summary = ctx.report.startStep('download-events');
  const rows = await ctx.wp.fileDownloads();
  summary.read = rows.length;

  // Lượt tải đầu tiên của mỗi (user, link) -> DownloadGrant (quyền tải lại miễn phí không giới hạn,
  // đúng comment sẵn trong schema); mọi lượt còn lại chỉ ghi DownloadEvent để giữ log phân tích.
  const grantedPairs = new Set<string>();

  for (const row of rows) {
    const userId = ctx.maps.userIdToNewId.get(row.user_id);
    const downloadLinkId = postIdToDownloadLinkId.get(row.post_id);
    if (!userId || !downloadLinkId) {
      summary.errors.push({
        ref: `file_download#${row.id}`,
        message: !userId ? `Không tìm thấy user đã migrate (WP user #${row.user_id})` : `Không tìm thấy download-link đã migrate (WP post #${row.post_id})`,
      });
      continue;
    }

    const pairKey = `${userId}:${downloadLinkId}`;
    const isFirstForPair = !grantedPairs.has(pairKey);
    grantedPairs.add(pairKey);

    if (ctx.dryRun) {
      summary.created++;
      continue;
    }

    try {
      if (isFirstForPair) {
        const existingGrant = await ctx.prisma.downloadGrant.findFirst({ where: { userId, downloadLinkId } });
        if (!existingGrant) {
          await ctx.prisma.downloadGrant.create({
            data: { userId, downloadLinkId, purchasedAt: row.downloaded_at },
          });
        }
      }

      const existingEvent = await ctx.prisma.downloadEvent.findFirst({
        where: { userId, downloadLinkId, createdAt: row.downloaded_at },
      });
      if (!existingEvent) {
        await ctx.prisma.downloadEvent.create({
          data: { userId, downloadLinkId, ipAddress: '0.0.0.0', createdAt: row.downloaded_at },
        });
        summary.created++;
      } else {
        summary.skipped++;
      }
    } catch (err) {
      summary.errors.push({ ref: `file_download#${row.id}`, message: (err as Error).message });
    }
  }
}
