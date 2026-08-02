import { existsSync, statSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { MigrationContext } from '../context';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Key mới tổ chức theo yyyy/mm/dd lấy từ post_date CỦA CHÍNH attachment đó (mỗi attachment trong WP
// có timestamp riêng, không chỉ yyyy/mm như thư mục uploads gốc) — đủ granularity theo ngày như yêu cầu.
function buildNewRelativeKey(postDate: Date, originalRelPath: string): string {
  const yyyy = postDate.getFullYear();
  const mm = pad2(postDate.getMonth() + 1);
  const dd = pad2(postDate.getDate());
  return `posts/${yyyy}/${mm}/${dd}/${basename(originalRelPath)}`;
}

export async function migrateAttachments(ctx: MigrationContext): Promise<void> {
  const summary = ctx.report.startStep('attachments');
  const [attachments, attachedFileMeta] = await Promise.all([
    ctx.wp.posts('attachment'),
    ctx.wp.postMetaByKey('_wp_attached_file'),
  ]);
  summary.read = attachments.length;

  const relPathByAttachmentId = new Map(attachedFileMeta.map((m) => [m.post_id, m.meta_value]));

  for (const attachment of attachments) {
    const relPath = relPathByAttachmentId.get(attachment.ID);
    if (!relPath) {
      summary.errors.push({ ref: `attachment#${attachment.ID}`, message: 'Thiếu _wp_attached_file' });
      continue;
    }

    try {
      const sourceFile = join(ctx.pictureDir, relPath);
      if (!existsSync(sourceFile)) {
        summary.errors.push({ ref: `attachment#${attachment.ID}`, message: `Không tìm thấy file nguồn: ${sourceFile}` });
        continue;
      }
      const sizeBytes = statSync(sourceFile).size;
      const newKey = buildNewRelativeKey(attachment.post_date, relPath);
      const publicUrl = `${ctx.apiBaseUrl}/uploads/${newKey}`;

      ctx.maps.attachmentRelPathToUrl.set(relPath, publicUrl);
      ctx.maps.attachmentRelPathToSize.set(relPath, sizeBytes);
      ctx.maps.attachmentIdToUrl.set(attachment.ID, publicUrl);

      if (ctx.dryRun) {
        summary.created++;
        continue;
      }

      const destFile = join(ctx.uploadsDir, newKey);
      await mkdir(dirname(destFile), { recursive: true });
      if (!existsSync(destFile)) {
        await copyFile(sourceFile, destFile);
        summary.created++;
      } else {
        summary.skipped++;
      }
    } catch (err) {
      summary.errors.push({ ref: `attachment#${attachment.ID} (${relPath})`, message: (err as Error).message });
    }
  }
}
