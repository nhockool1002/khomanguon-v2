"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Category, PostDetail, PostStatus } from "@/lib/types";
import { ErrorBanner, FormField, SubmitButton, SuccessBanner } from "@/components/ui";

const STATUS_LABEL: Record<PostStatus, string> = {
  DRAFT: "Nháp",
  PENDING_REVIEW: "Chờ duyệt",
  PUBLISHED: "Xuất bản",
};

export interface PostFormValues {
  title: string;
  slug: string;
  excerpt: string;
  thumbnailUrl: string;
  categoryId: string;
  contentHtml: string;
  status: PostStatus;
}

// Form CRUD bài viết dùng chung cho trang tạo mới và chỉnh sửa (khung cơ bản — chưa có WYSIWYG, xem PLAN.md 1.4/2.1).
export function PostForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<PostDetail>;
  submitLabel: string;
  onSubmit: (values: PostFormValues) => Promise<void>;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(initial?.thumbnailUrl ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [contentHtml, setContentHtml] = useState(initial?.contentHtml ?? "");
  const [status, setStatus] = useState<PostStatus>(initial?.status ?? "DRAFT");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Category[]>("/categories").then(setCategories).catch(() => setCategories([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await onSubmit({ title, slug, excerpt, thumbnailUrl, categoryId, contentHtml, status });
      setMessage("Đã lưu bài viết.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      <FormField
        label="Tiêu đề"
        required
        minLength={3}
        maxLength={200}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <FormField
        label="Slug (để trống để tự sinh từ tiêu đề)"
        maxLength={220}
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
      />
      <FormField
        label="Ảnh đại diện (URL)"
        value={thumbnailUrl}
        onChange={(e) => setThumbnailUrl(e.target.value)}
      />

      <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
        Danh mục
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        >
          <option value="">— Không chọn —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
        Tóm tắt
        <textarea
          value={excerpt}
          maxLength={500}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={2}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
        Nội dung (textarea tạm — chưa có WYSIWYG)
        <textarea
          required
          value={contentHtml}
          onChange={(e) => setContentHtml(e.target.value)}
          rows={12}
          className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
        Trạng thái
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PostStatus)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        >
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span className="text-xs text-zinc-400">
          Chỉ Admin/Super Moderator mới xuất bản được (quyền post.publish).
        </span>
      </label>

      <div>
        <SubmitButton type="submit" loading={saving}>
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
