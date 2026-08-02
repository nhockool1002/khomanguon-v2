"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Category, PostDetail, PostStatus } from "@/lib/types";
import { ErrorBanner, FormField, SuccessBanner } from "@/components/ui";
import { RichTextEditor } from "@/components/rich-text-editor";
import { ImageUploadField } from "@/components/image-upload-field";
import { SeoPanel } from "@/components/seo-panel";
import { DownloadConfigPanel } from "@/components/download-config-panel";

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
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  canonicalUrl: string;
}

// Form CRUD bài viết dùng chung cho trang tạo mới và chỉnh sửa — WYSIWYG Tiptap + SEO panel (Phase 2.1).
export function PostForm({
  initial,
  onSubmit,
}: {
  initial?: Partial<PostDetail>;
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
  const [metaTitle, setMetaTitle] = useState(initial?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(initial?.metaDescription ?? "");
  const [ogImageUrl, setOgImageUrl] = useState(initial?.ogImageUrl ?? "");
  const [canonicalUrl, setCanonicalUrl] = useState(initial?.canonicalUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Category[]>("/categories").then(setCategories).catch(() => setCategories([]));
  }, []);

  async function submitWithStatus(targetStatus: PostStatus) {
    setError(null);
    setMessage(null);

    if (title.trim().length < 3) {
      setError("Tiêu đề phải có ít nhất 3 ký tự");
      return;
    }
    if (contentHtml.trim().length === 0) {
      setError("Nội dung không được để trống");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        title,
        slug,
        excerpt,
        thumbnailUrl,
        categoryId,
        contentHtml,
        status: targetStatus,
        metaTitle,
        metaDescription,
        ogImageUrl,
        canonicalUrl,
      });
      setStatus(targetStatus);
      setMessage("Đã lưu bài viết.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex flex-1 flex-col gap-4">
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
            Nội dung
            <RichTextEditor value={contentHtml} onChange={setContentHtml} />
          </label>
        </div>

        <div className="flex w-full flex-col gap-4 lg:w-80 lg:flex-none">
          <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Xuất bản
            </p>
            <p className="text-sm text-zinc-600">
              Trạng thái hiện tại: <span className="font-medium">{STATUS_LABEL[status]}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => submitWithStatus("DRAFT")}
                disabled={saving}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Lưu nháp
              </button>
              <button
                type="button"
                onClick={() => submitWithStatus("PENDING_REVIEW")}
                disabled={saving}
                className="rounded-md border border-[#1d3557] px-3 py-1.5 text-sm font-medium text-[#1d3557] hover:bg-[#1d3557]/5 disabled:opacity-50"
              >
                Gửi duyệt
              </button>
              <button
                type="button"
                onClick={() => submitWithStatus("PUBLISHED")}
                disabled={saving}
                className="rounded-md bg-[#1d3557] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Xuất bản"}
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Chỉ Admin/Super Moderator mới xuất bản được (quyền post.publish).
            </p>
          </div>

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

          <ImageUploadField
            label="Ảnh đại diện"
            value={thumbnailUrl}
            onChange={setThumbnailUrl}
          />

          <SeoPanel
            metaTitle={metaTitle}
            onMetaTitleChange={setMetaTitle}
            metaDescription={metaDescription}
            onMetaDescriptionChange={setMetaDescription}
            canonicalUrl={canonicalUrl}
            onCanonicalUrlChange={setCanonicalUrl}
            fallbackTitle={title}
            fallbackDescription={excerpt}
            previewPath={`/bai-viet/${slug || "duong-dan-bai-viet"}`}
          />

          <ImageUploadField label="Ảnh OG (chia sẻ mạng xã hội)" value={ogImageUrl} onChange={setOgImageUrl} />
        </div>
      </div>

      <DownloadConfigPanel postId={initial?.id} />
    </div>
  );
}
