import Link from "next/link";
import type { PostSummary } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { StyledUserName } from "@/components/styled-user-name";

// Thẻ bài viết dạng lưới cho trang chủ (wireframe #01): ảnh -> tiêu đề (navy) -> meta -> excerpt 2 dòng.
export function PostCard({ post }: { post: PostSummary }) {
  return (
    <Link
      href={`/bai-viet/${post.slug}`}
      className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 transition-shadow hover:shadow-md"
    >
      <div className="flex h-[120px] items-center justify-center overflow-hidden rounded-md bg-zinc-100">
        {post.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnailUrl}
            alt={post.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="font-mono text-xs text-zinc-400">Chưa có ảnh</span>
        )}
      </div>
      <h3 className="line-clamp-2 text-sm font-semibold text-[#1d3557]" title={post.title}>
        {post.title}
      </h3>
      <p className="flex flex-wrap items-center gap-1 font-mono text-xs text-[#5c6370]">
        <StyledUserName styleRoleSlug={post.author.styleRoleSlug}>
          {post.author.displayName}
        </StyledUserName>
        <span>· {formatDate(post.publishedAt ?? post.createdAt)}</span>
      </p>
      {post.excerpt && (
        <p className="line-clamp-2 text-xs text-zinc-500">{post.excerpt}</p>
      )}
    </Link>
  );
}
