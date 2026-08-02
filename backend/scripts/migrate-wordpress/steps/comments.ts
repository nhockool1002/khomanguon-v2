import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { decodeWpEntities } from '../wp-content';
import type { MigrationContext } from '../context';

async function randomUnusablePasswordHash(): Promise<string> {
  return argon2.hash(randomBytes(32).toString('hex'));
}

// Comment không tài khoản (khách, chỉ nhập tên/email) — Comment.userId ở v2 bắt buộc không rỗng,
// nên tạo User "placeholder" theo email khách (Migration_Plan.md §4.4). Không gán role/không login được.
async function resolveGuestUserId(
  ctx: MigrationContext,
  guestName: string,
  guestEmail: string,
  fallbackId: number,
): Promise<string> {
  const email = (guestEmail || `guest-${fallbackId}@migrated.khomanguon.local`).trim().toLowerCase();
  const existing = await ctx.prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;
  if (ctx.dryRun) return `dryrun-guest:${email}`;

  const created = await ctx.prisma.user.create({
    data: {
      email,
      passwordHash: await randomUnusablePasswordHash(),
      displayName: guestName || email,
      status: 'ACTIVE',
      wallet: { create: { balance: 0 } },
    },
  });
  return created.id;
}

export async function migrateComments(ctx: MigrationContext): Promise<void> {
  const summary = ctx.report.startStep('comments');
  const comments = await ctx.wp.comments();
  summary.read = comments.length;

  const wpCommentIdToNewId = new Map<number, string>();

  for (const comment of comments) {
    if (comment.comment_approved !== '1') {
      summary.skipped++; // spam/pending/trash — không migrate
      continue;
    }

    try {
      const postId = ctx.maps.postIdToNewId.get(comment.comment_post_ID);
      if (!postId) {
        summary.errors.push({ ref: `comment#${comment.comment_ID}`, message: `Không tìm thấy post đã migrate (WP post #${comment.comment_post_ID})` });
        continue;
      }

      const userId = comment.user_id
        ? ctx.maps.userIdToNewId.get(comment.user_id)
        : await resolveGuestUserId(ctx, comment.comment_author, comment.comment_author_email, comment.comment_ID);
      if (!userId) {
        summary.errors.push({ ref: `comment#${comment.comment_ID}`, message: `Không tìm thấy user đã migrate (WP user #${comment.user_id})` });
        continue;
      }

      const content = decodeWpEntities(comment.comment_content);
      const parentId = comment.comment_parent ? wpCommentIdToNewId.get(comment.comment_parent) ?? null : null;

      if (ctx.dryRun) {
        wpCommentIdToNewId.set(comment.comment_ID, `dryrun:${comment.comment_ID}`);
        summary.created++;
        continue;
      }

      const existing = await ctx.prisma.comment.findFirst({
        where: { postId, userId, content, createdAt: comment.comment_date },
      });
      const record = existing
        ? existing
        : await ctx.prisma.comment.create({
            data: { postId, userId, parentId, content, status: 'PUBLISHED', createdAt: comment.comment_date },
          });
      existing ? summary.skipped++ : summary.created++;

      wpCommentIdToNewId.set(comment.comment_ID, record.id);
    } catch (err) {
      summary.errors.push({ ref: `comment#${comment.comment_ID}`, message: (err as Error).message });
    }
  }
}
