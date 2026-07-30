import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPostBySlug } from "@/lib/public-api";
import { GradientUnderline } from "@/components/gradient-underline";
import { formatDate, formatViewCount } from "@/lib/format";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await fetchPostBySlug(slug);
  if (!post) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
      <nav className="flex items-center gap-1.5 font-mono text-xs text-zinc-500">
        <Link href="/" className="hover:text-[#1d3557]">
          Trang chủ
        </Link>
        {post.category && (
          <>
            <span>/</span>
            <Link href={`/danh-muc/${post.category.slug}`} className="hover:text-[#1d3557]">
              {post.category.name}
            </Link>
          </>
        )}
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-zinc-900">{post.title}</h1>
        <GradientUnderline />
      </div>

      <div className="flex items-center gap-2 font-mono text-xs text-[#5c6370]">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2b3f5c] text-[10px] uppercase text-white">
          {post.author.displayName.charAt(0)}
        </span>
        <span>{post.author.displayName}</span>
        <span>·</span>
        <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
        <span>·</span>
        <span>{formatViewCount(post.viewCount)}</span>
      </div>

      {post.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.thumbnailUrl}
          alt={post.title}
          className="max-h-96 w-full rounded-lg object-cover"
        />
      )}

      {/* Chưa có WYSIWYG (Phase 2.1) — nội dung là text thô từ textarea, hiển thị nguyên văn thay vì HTML. */}
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
        {post.contentHtml}
      </div>
    </main>
  );
}
