"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import type { PostDetail } from "@/lib/types";
import { PostForm, type PostFormValues } from "@/components/post-form";
import { ErrorBanner } from "@/components/ui";

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
    return <div className="flex-1 px-6 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
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
        contentHtml: values.contentHtml,
        status: values.status,
      }),
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-xl font-semibold text-zinc-900">Chỉnh sửa bài viết</h1>
      <ErrorBanner message={error} />
      {post && <PostForm initial={post} submitLabel="Lưu thay đổi" onSubmit={handleSubmit} />}
    </div>
  );
}
