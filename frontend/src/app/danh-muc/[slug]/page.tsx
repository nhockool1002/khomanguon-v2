import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchCategories, fetchPosts } from "@/lib/public-api";
import { PostRow } from "@/components/post-row";
import { Pagination } from "@/components/pagination";
import { SortLinks } from "@/components/sort-links";

const PAGE_SIZE = 10;

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: "newest" | "popular" }>;
}) {
  const { slug } = await params;
  const { page: pageParam, sort: sortParam } = await searchParams;
  const page = Math.max(Number(pageParam) || 1, 1);
  const sort = sortParam === "popular" ? "popular" : "newest";

  const categories = await fetchCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const { items: posts, total } = await fetchPosts({
    categorySlug: slug,
    sort,
    page,
    limit: PAGE_SIZE,
  });
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const siblingCategories = categories.filter((c) => c.parentId === category.parentId);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8">
      <nav className="flex items-center gap-1.5 font-mono text-xs text-zinc-500">
        <Link href="/" className="hover:text-[#1d3557]">
          Trang chủ
        </Link>
        <span>/</span>
        <span className="text-zinc-800">{category.name}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-zinc-900">{category.name}</h1>
        <SortLinks baseHref={`/danh-muc/${slug}`} sort={sort} />
      </div>

      {siblingCategories.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {siblingCategories.map((c) => (
            <Link
              key={c.id}
              href={`/danh-muc/${c.slug}`}
              className={`rounded-full border px-2.5 py-1 font-mono text-xs ${
                c.slug === slug
                  ? "border-[#1d3557] bg-[#1d3557] text-white"
                  : "border-zinc-200 text-zinc-600 hover:border-[#1d3557] hover:text-[#1d3557]"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {posts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
            Chưa có bài viết nào trong danh mục này.
          </p>
        ) : (
          posts.map((post) => <PostRow key={post.id} post={post} />)
        )}
      </div>

      <Pagination
        baseHref={`/danh-muc/${slug}`}
        page={page}
        totalPages={totalPages}
        extraQuery={{ sort }}
      />
    </main>
  );
}
