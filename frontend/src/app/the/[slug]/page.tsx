import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchTags, fetchPosts } from "@/lib/public-api";
import { PostRow } from "@/components/post-row";
import { Pagination } from "@/components/pagination";
import { SortLinks } from "@/components/sort-links";

const PAGE_SIZE = 10;

export default async function TagPage({
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

  const tags = await fetchTags();
  const tag = tags.find((t) => t.slug === slug);
  if (!tag) notFound();

  const { items: posts, total } = await fetchPosts({
    tagSlug: slug,
    sort,
    page,
    limit: PAGE_SIZE,
  });
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8">
      <nav className="flex items-center gap-1.5 font-mono text-xs text-zinc-500">
        <Link href="/" className="hover:text-[#1d3557]">
          Trang chủ
        </Link>
        <span>/</span>
        <span className="text-zinc-800">Thẻ: {tag.name}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-zinc-900">#{tag.name}</h1>
        <SortLinks baseHref={`/the/${slug}`} sort={sort} />
      </div>

      <div className="flex flex-col gap-3">
        {posts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
            Chưa có bài viết nào gắn thẻ này.
          </p>
        ) : (
          posts.map((post) => <PostRow key={post.id} post={post} />)
        )}
      </div>

      <Pagination
        baseHref={`/the/${slug}`}
        page={page}
        totalPages={totalPages}
        extraQuery={{ sort }}
      />
    </main>
  );
}
