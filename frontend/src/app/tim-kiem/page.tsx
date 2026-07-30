import Link from "next/link";
import { fetchPosts } from "@/lib/public-api";
import { PostRow } from "@/components/post-row";
import { Pagination } from "@/components/pagination";
import { SortLinks } from "@/components/sort-links";

const PAGE_SIZE = 10;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: "newest" | "popular" }>;
}) {
  const { q, page: pageParam, sort: sortParam } = await searchParams;
  const page = Math.max(Number(pageParam) || 1, 1);
  const sort = sortParam === "popular" ? "popular" : "newest";
  const query = q?.trim() ?? "";

  const { items: posts, total } = query
    ? await fetchPosts({ q: query, sort, page, limit: PAGE_SIZE })
    : { items: [], total: 0 };
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8">
      <nav className="flex items-center gap-1.5 font-mono text-xs text-zinc-500">
        <Link href="/" className="hover:text-[#1d3557]">
          Trang chủ
        </Link>
        <span>/</span>
        <span className="text-zinc-800">Tìm kiếm</span>
      </nav>

      <form action="/tim-kiem" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Tìm kiếm bài viết..."
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        />
        <button
          type="submit"
          className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a]"
        >
          Tìm
        </button>
      </form>

      {query && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-sm text-zinc-600">
            Kết quả cho <span className="font-semibold text-zinc-900">&ldquo;{query}&rdquo;</span>{" "}
            ({total})
          </h1>
          <SortLinks baseHref="/tim-kiem" extraQuery={{ q: query }} sort={sort} />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {!query ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
            Nhập từ khoá để tìm kiếm bài viết.
          </p>
        ) : posts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
            Không tìm thấy bài viết nào phù hợp.
          </p>
        ) : (
          posts.map((post) => <PostRow key={post.id} post={post} />)
        )}
      </div>

      {query && (
        <Pagination
          baseHref="/tim-kiem"
          page={page}
          totalPages={totalPages}
          extraQuery={{ q: query, sort }}
        />
      )}
    </main>
  );
}
