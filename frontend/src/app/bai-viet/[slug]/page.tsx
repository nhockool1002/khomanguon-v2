import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPostBySlug } from "@/lib/public-api";
import { GradientUnderline } from "@/components/gradient-underline";
import { DownloadBox } from "@/components/download-box";
import { WidgetArea } from "@/components/widget-area";
import { StyledUserName } from "@/components/styled-user-name";
import { ProseContent } from "@/components/prose-content";
import { formatDate, formatViewCount } from "@/lib/format";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPostBySlug(slug);
  if (!post) return {};

  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt || undefined;

  return {
    title,
    description,
    alternates: post.canonicalUrl ? { canonical: post.canonicalUrl } : undefined,
    openGraph: {
      title,
      description,
      images: post.ogImageUrl || post.thumbnailUrl ? [post.ogImageUrl || post.thumbnailUrl!] : undefined,
    },
  };
}

export default async function PostDetailPage({ params }: Props) {
  const { slug } = await params;
  const post = await fetchPostBySlug(slug);
  if (!post) notFound();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex flex-col gap-4 lg:flex-[3]">
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
            <StyledUserName styleRoleSlug={post.author.styleRoleSlug} userId={post.author.id}>
              {post.author.displayName}
            </StyledUserName>
            <span>·</span>
            <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
            <span>·</span>
            <span>{formatViewCount(post.viewCount)}</span>
          </div>

          {post.thumbnailUrl && (
            <span className="img-shine block w-full rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.thumbnailUrl}
                alt={post.title}
                className="max-h-96 w-full rounded-lg object-cover"
              />
            </span>
          )}

          {/* Nội dung soạn từ Tiptap (Phase 2.1) — HTML thật do admin/mod đã qua permission gate, không phải input công khai. */}
          <ProseContent
            html={post.contentHtml}
            className="prose prose-sm max-w-none text-zinc-800 [&_.img-shine]:rounded-md [&_.img-shine_img]:rounded-md"
          />

          <DownloadBox postId={post.id} />
        </div>

        <div className="flex flex-col gap-4 lg:flex-1">
          <WidgetArea area="sidebar" postId={post.id} />
        </div>
      </div>
    </main>
  );
}
