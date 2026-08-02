import { slugify, buildUniqueSlug } from '../../../src/common/slugify';
import type { MigrationContext } from '../context';

// Giữ nguyên slug gốc của WP (đã URL-safe sẵn) để không vỡ link cũ — chỉ chạy qua slugify()
// phòng trường hợp slug nguồn có ký tự lạ, và buildUniqueSlug nếu trùng.
async function resolveSlug(
  ctx: MigrationContext,
  rawSlug: string,
  fallbackName: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const cleaned = slugify(rawSlug) || slugify(fallbackName);
  if (cleaned && !(await exists(cleaned))) return cleaned;
  return buildUniqueSlug(fallbackName, exists);
}

export async function migrateTaxonomy(ctx: MigrationContext): Promise<void> {
  await migrateCategories(ctx);
  await migrateTags(ctx);
}

async function migrateCategories(ctx: MigrationContext): Promise<void> {
  const summary = ctx.report.startStep('categories');
  const [terms, taxonomies] = await Promise.all([ctx.wp.terms(), ctx.wp.termTaxonomies('category')]);
  const termById = new Map(terms.map((t) => [t.term_id, t]));
  summary.read = taxonomies.length;

  // Pass 1 — tạo/tìm category chưa gán parent, ghi map term_taxonomy_id -> Category.id
  const ttIdToNewId = new Map<number, string>();
  for (const tt of taxonomies) {
    const term = termById.get(tt.term_id);
    if (!term) {
      summary.errors.push({ ref: `term_taxonomy#${tt.term_taxonomy_id}`, message: 'Không tìm thấy term tương ứng' });
      continue;
    }
    try {
      const existing = await ctx.prisma.category.findUnique({ where: { slug: slugify(term.slug) || slugify(term.name) } });
      if (ctx.dryRun) {
        ttIdToNewId.set(tt.term_taxonomy_id, existing?.id ?? `dryrun:${term.slug}`);
        ctx.maps.categoryTermIdToNewId.set(tt.term_id, existing?.id ?? `dryrun:${term.slug}`);
        existing ? summary.skipped++ : summary.created++;
        continue;
      }

      const slug = await resolveSlug(ctx, term.slug, term.name, async (c) => {
        const found = await ctx.prisma.category.findUnique({ where: { slug: c } });
        return found !== null && found.id !== existing?.id;
      });

      const category = existing
        ? existing
        : await ctx.prisma.category.create({ data: { name: term.name, slug } });
      existing ? summary.skipped++ : summary.created++;

      ttIdToNewId.set(tt.term_taxonomy_id, category.id);
      ctx.maps.categoryTermIdToNewId.set(tt.term_id, category.id);
    } catch (err) {
      summary.errors.push({ ref: `category "${term.name}"`, message: (err as Error).message });
    }
  }

  // Pass 2 — gán parentId giờ mọi category đích đã tồn tại
  if (!ctx.dryRun) {
    for (const tt of taxonomies) {
      if (!tt.parent) continue;
      const categoryId = ttIdToNewId.get(tt.term_taxonomy_id);
      const parentId = ttIdToNewId.get(tt.parent);
      if (!categoryId || !parentId || categoryId === parentId) continue;
      await ctx.prisma.category.update({ where: { id: categoryId }, data: { parentId } });
    }
  }
}

async function migrateTags(ctx: MigrationContext): Promise<void> {
  const summary = ctx.report.startStep('tags');
  const [terms, taxonomies] = await Promise.all([ctx.wp.terms(), ctx.wp.termTaxonomies('post_tag')]);
  const termById = new Map(terms.map((t) => [t.term_id, t]));
  summary.read = taxonomies.length;

  for (const tt of taxonomies) {
    const term = termById.get(tt.term_id);
    if (!term) {
      summary.errors.push({ ref: `term_taxonomy#${tt.term_taxonomy_id}`, message: 'Không tìm thấy term tương ứng' });
      continue;
    }
    try {
      const existing = await ctx.prisma.tag.findUnique({ where: { slug: slugify(term.slug) || slugify(term.name) } });
      if (ctx.dryRun) {
        ctx.maps.tagTermIdToNewId.set(tt.term_id, existing?.id ?? `dryrun:${term.slug}`);
        existing ? summary.skipped++ : summary.created++;
        continue;
      }

      const slug = await resolveSlug(ctx, term.slug, term.name, async (c) => {
        const found = await ctx.prisma.tag.findUnique({ where: { slug: c } });
        return found !== null && found.id !== existing?.id;
      });

      const tag = existing ? existing : await ctx.prisma.tag.create({ data: { name: term.name, slug } });
      existing ? summary.skipped++ : summary.created++;

      ctx.maps.tagTermIdToNewId.set(tt.term_id, tag.id);
    } catch (err) {
      summary.errors.push({ ref: `tag "${term.name}"`, message: (err as Error).message });
    }
  }
}
