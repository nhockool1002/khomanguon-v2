"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { PostDetail } from "@/lib/types";
import { PostForm, type PostFormValues } from "@/components/post-form";
import { ForbiddenPage } from "@/components/forbidden-page";

export default function NewPostPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.POST_CREATE)) {
    return <ForbiddenPage />;
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
        tagIds: values.tagIds,
        contentHtml: values.contentHtml,
        status: values.status,
        metaTitle: values.metaTitle || undefined,
        metaDescription: values.metaDescription || undefined,
        ogImageUrl: values.ogImageUrl || undefined,
        canonicalUrl: values.canonicalUrl || undefined,
      }),
    });
    router.push(`/admin/posts/${created.id}`);
  }

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Bài viết mới</h1>
      <PostForm onSubmit={handleSubmit} />
    </div>
  );
}
