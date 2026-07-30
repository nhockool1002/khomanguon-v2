"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import type { PostDetail } from "@/lib/types";
import { PostForm, type PostFormValues } from "@/components/post-form";

export default function NewPostPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }

  async function handleSubmit(values: PostFormValues) {
    const created = await apiFetch<PostDetail>("/posts", {
      method: "POST",
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
    router.push(`/quan-tri/bai-viet/${created.id}`);
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6 px-8 py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Bài viết mới</h1>
      <PostForm submitLabel="Tạo bài viết" onSubmit={handleSubmit} />
    </div>
  );
}
