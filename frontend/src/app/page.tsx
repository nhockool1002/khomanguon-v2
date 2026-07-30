import Link from "next/link";
import { fetchCategories, fetchPosts } from "@/lib/public-api";
import { PostCard } from "@/components/post-card";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 9;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(Number(pageParam) || 1, 1);

  const [{ items: posts, total }, categories] = await Promise.all([
    fetchPosts({ page, limit: PAGE_SIZE }),
    fetchCategories(),
  ]);
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <section className="rounded-lg bg-gradient-to-r from-[#1d3557] to-[#2b3f5c] px-8 py-10 text-white">
        <p className="font-mono text-xs uppercase tracking-widest text-white/70">
          khomanguon.vn
        </p>
        <h1 className="mt-2 max-w-lg text-2xl font-semibold">
          Mở kho, dựng lại thanh xuân — kho mã nguồn Game/Web/App cho cộng đồng Việt
        </h1>
      </section>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex flex-col gap-4 lg:flex-[3]">
          <h2 className="text-sm font-semibold text-zinc-900">Bài viết mới nhất</h2>
          {posts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
              Chưa có bài viết nào được đăng.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
          <Pagination baseHref="/" page={page} totalPages={totalPages} />
        </div>

        <aside className="flex flex-col gap-4 lg:flex-1">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Danh mục
            </h3>
            {categories.length === 0 ? (
              <p className="text-xs text-zinc-400">Chưa có danh mục.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/danh-muc/${c.slug}`}
                    className="rounded-full border border-zinc-200 px-2.5 py-1 font-mono text-xs text-zinc-600 hover:border-[#1d3557] hover:text-[#1d3557]"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
