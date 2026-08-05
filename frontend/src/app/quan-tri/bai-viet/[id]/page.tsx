"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { PostDetail } from "@/lib/types";
import { PostForm, type PostFormValues } from "@/components/post-form";
import { ErrorBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<PostDetail>(`/posts/admin/${id}`)
      .then(setPost)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [user, id]);

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.POST_CREATE)) {
    return <ForbiddenPage />;
  }

  async function handleSubmit(values: PostFormValues) {
    await apiFetch<PostDetail>(`/posts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: values.title,
        slug: values.slug || undefined,
        excerpt: values.excerpt || undefined,
        thumbnailUrl: values.thumbnailUrl || undefined,
        categoryId: values.categoryId || undefined,
        tagIds: values.tagIds,
        contentHtml: values.contentHtml,
        status: values.status,
        metaTitle: values.metaTitle || undefined,
        metaDescription: values.metaDescription || undefined,
        ogImageUrl: values.ogImageUrl || undefined,
        canonicalUrl: values.canonicalUrl || undefined,
      }),
    });
  }

  return (
    <div className="flex w-full flex-col gap-6 px-8 py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Chỉnh sửa bài viết</h1>
      <ErrorBanner message={error} />
      {post && <PostForm initial={post} onSubmit={handleSubmit} />}
    </div>
  );
}
