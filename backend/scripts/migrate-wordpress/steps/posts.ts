import type { PostStatus } from '@prisma/client';
import { slugify, buildUniqueSlug } from '../../../src/common/slugify';
import { decodeWpEntities, rewriteContentImageUrls, wpautop } from '../wp-content';
import type { MigrationContext } from '../context';

const STATUS_MAP: Record<string, PostStatus> = {
  publish: 'PUBLISHED',
  draft: 'DRAFT',
  pending: 'PENDING_REVIEW',
  private: 'DRAFT',
};

export async function migratePosts(ctx: MigrationContext): Promise<void> {
  const summary = ctx.report.startStep('posts');
  const [
    wpPosts,
    thumbnailMeta,
    categoryTaxonomies,
    tagTaxonomies,
    termRelationships,
  ] = await Promise.all([
    ctx.wp.posts('post'),
    ctx.wp.postMetaByKey('_thumbnail_id'),
    ctx.wp.termTaxonomies('category'),
    ctx.wp.termTaxonomies('post_tag'),
    ctx.wp.termRelationships(),
  ]);
  summary.read = wpPosts.length;

  const thumbnailIdByPostId = new Map(thumbnailMeta.map((m) => [m.post_id, Number(m.meta_value)]));
  const ttIdToTermId = new Map<number, { termId: number; kind: 'category' | 'tag' }>();
  for (const tt of categoryTaxonomies) ttIdToTermId.set(tt.term_taxonomy_id, { termId: tt.term_id, kind: 'category' });
  for (const tt of tagTaxonomies) ttIdToTermId.set(tt.term_taxonomy_id, { termId: tt.term_id, kind: 'tag' });

  const relationshipsByPostId = new Map<number, number[]>();
  for (const rel of termRelationships) {
    const list = relationshipsByPostId.get(rel.object_id) ?? [];
    list.push(rel.term_taxonomy_id);
    relationshipsByPostId.set(rel.object_id, list);
  }

  for (const wpPost of wpPosts) {
    const status = STATUS_MAP[wpPost.post_status];
    if (!status) {
      summary.skipped++; // trash/auto-draft/future/inherit — không có ý nghĩa để migrate
      continue;
    }

    try {
      const authorId = ctx.maps.userIdToNewId.get(wpPost.post_author);
      if (!authorId) {
        summary.errors.push({ ref: `post#${wpPost.ID} (${wpPost.post_title})`, message: `Không tìm thấy author đã migrate (WP user #${wpPost.post_author})` });
        continue;
      }

      // v2 Post chỉ có 1 categoryId — WP cho nhiều category/post, lấy cái đầu tiên theo thứ tự
      // term_taxonomy_id, các category khác (nếu có) bị bỏ, đây là giới hạn đã biết của schema hiện tại.
      let categoryId: string | undefined;
      const tagIds: string[] = [];
      for (const ttId of relationshipsByPostId.get(wpPost.ID) ?? []) {
        const resolved = ttIdToTermId.get(ttId);
        if (!resolved) continue;
        if (resolved.kind === 'category') {
          const mapped = ctx.maps.categoryTermIdToNewId.get(resolved.termId);
          if (mapped && !categoryId) categoryId = mapped;
        } else {
          const mapped = ctx.maps.tagTermIdToNewId.get(resolved.termId);
          if (mapped) tagIds.push(mapped);
        }
      }

      const thumbnailId = thumbnailIdByPostId.get(wpPost.ID);
      const thumbnailUrl = thumbnailId ? ctx.maps.attachmentIdToUrl.get(thumbnailId) : undefined;

      const contentHtml = rewriteContentImageUrls(wpautop(wpPost.post_content), (relPath) => {
        return ctx.maps.attachmentRelPathToUrl.get(relPath) ?? null;
      });

      const title = decodeWpEntities(wpPost.post_title);
      const excerptDecoded = decodeWpEntities(wpPost.post_excerpt).trim();

      const sourceSlug = slugify(wpPost.post_name) || slugify(title) || `post-${wpPost.ID}`;
      const existing = await ctx.prisma.post.findUnique({ where: { slug: sourceSlug } });

      if (ctx.dryRun) {
        ctx.maps.postIdToNewId.set(wpPost.ID, existing?.id ?? `dryrun:${wpPost.ID}`);
        ctx.maps.postIdToSlug.set(wpPost.ID, existing?.slug ?? sourceSlug);
        existing ? summary.skipped++ : summary.created++;
        continue;
      }

      const slug = await buildUniqueSlug(wpPost.post_name || title, async (candidate) => {
        const found = await ctx.prisma.post.findUnique({ where: { slug: candidate } });
        return found !== null && found.id !== existing?.id;
      });

      const data = {
        title,
        slug: existing ? existing.slug : slug,
        excerpt: excerptDecoded || null,
        contentHtml,
        thumbnailUrl: thumbnailUrl ?? null,
        status,
        authorId,
        categoryId: categoryId ?? null,
        publishedAt: status === 'PUBLISHED' ? wpPost.post_date : null,
      };

      const post = existing
        ? await ctx.prisma.post.update({ where: { id: existing.id }, data })
        : await ctx.prisma.post.create({ data: { ...data, createdAt: wpPost.post_date } });
      existing ? summary.updated++ : summary.created++;

      await ctx.prisma.postTag.deleteMany({ where: { postId: post.id } });
      for (const tagId of [...new Set(tagIds)]) {
        await ctx.prisma.postTag.create({ data: { postId: post.id, tagId } });
      }

      ctx.maps.postIdToNewId.set(wpPost.ID, post.id);
      ctx.maps.postIdToSlug.set(wpPost.ID, post.slug);
    } catch (err) {
      summary.errors.push({ ref: `post#${wpPost.ID} (${wpPost.post_title})`, message: (err as Error).message });
    }
  }
}
