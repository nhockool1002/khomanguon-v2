import Link from "next/link";
import type { PostSummary } from "@/lib/types";
import { formatDate } from "@/lib/format";

// Thẻ bài viết dạng hàng ngang cho trang danh mục (wireframe #02).
export function PostRow({ post }: { post: PostSummary }) {
  return (
    <Link
      href={`/bai-viet/${post.slug}`}
      className="flex gap-4 rounded-lg border border-zinc-200 bg-white p-3 transition-shadow hover:shadow-md"
    >
      <div className="flex h-16 w-24 flex-none items-center justify-center overflow-hidden rounded-md bg-zinc-100">
        {post.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnailUrl}
            alt={post.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="font-mono text-[10px] text-zinc-400">Chưa có ảnh</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-[#1d3557]" title={post.title}>{post.title}</h3>
        <p className="font-mono text-xs text-[#5c6370]">
          {post.author.displayName} · {formatDate(post.publishedAt ?? post.createdAt)}
        </p>
        {post.excerpt && (
          <p className="line-clamp-2 text-xs text-zinc-500">{post.excerpt}</p>
        )}
      </div>
    </Link>
  );
}
