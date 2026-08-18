"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Category, PostDetail, PostStatus, Tag } from "@/lib/types";
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
  tagIds: string[];
  contentHtml: string;
  status: PostStatus;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  canonicalUrl: string;
  jsonLd: string;
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
  const [tags, setTags] = useState<Tag[]>([]);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(initial?.thumbnailUrl ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [tagIds, setTagIds] = useState<string[]>(
    initial?.tags?.map((t) => t.id) ?? [],
  );
  const [contentHtml, setContentHtml] = useState(initial?.contentHtml ?? "");
  const [status, setStatus] = useState<PostStatus>(initial?.status ?? "DRAFT");
  const [metaTitle, setMetaTitle] = useState(initial?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(initial?.metaDescription ?? "");
  const [ogImageUrl, setOgImageUrl] = useState(initial?.ogImageUrl ?? "");
  const [canonicalUrl, setCanonicalUrl] = useState(initial?.canonicalUrl ?? "");
  const [jsonLd, setJsonLd] = useState(initial?.jsonLd ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  useEffect(() => {
    apiFetch<Category[]>("/categories").then(setCategories).catch(() => setCategories([]));
    apiFetch<Tag[]>("/tags").then(setTags).catch(() => setTags([]));
  }, []);

  function toggleTag(tagId: string) {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }

  // Nhập tên tag rồi Enter — nếu trùng tag có sẵn (không phân biệt hoa/thường) thì chọn luôn,
  // nếu chưa có thì tạo mới qua POST /tags (yêu cầu quyền post.publish, giống categories — tránh
  // spam taxonomy từ tài khoản chỉ có quyền post.create).
  async function handleAddTag() {
    const name = tagInput.trim();
    if (!name) return;
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!tagIds.includes(existing.id)) setTagIds((prev) => [...prev, existing.id]);
      setTagInput("");
      return;
    }
    setCreatingTag(true);
    setError(null);
    try {
      const created = await apiFetch<Tag>("/tags", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setTags((prev) => [...prev, created]);
      setTagIds((prev) => [...prev, created.id]);
      setTagInput("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tạo tag mới");
    } finally {
      setCreatingTag(false);
    }
  }

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
    if (jsonLd.trim()) {
      try {
        JSON.parse(jsonLd);
      } catch {
        setError("JSON-LD tuỳ chỉnh không phải JSON hợp lệ — kiểm tra lại cú pháp.");
        return;
      }
    }

    setSaving(true);
    try {
      await onSubmit({
        title,
        slug,
        excerpt,
        thumbnailUrl,
        categoryId,
        tagIds,
        contentHtml,
        status: targetStatus,
        metaTitle,
        metaDescription,
        ogImageUrl,
        canonicalUrl,
        jsonLd,
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
          {/* KHÔNG dùng <label> bọc RichTextEditor — RichTextEditor chứa nhiều <input> thật (màu chữ,
              màu nền, nhập tài liệu). Nếu bọc trong <label>, trình duyệt tự coi input ĐẦU TIÊN trong
              cây DOM là "control được gán nhãn": bấm vào BẤT KỲ đâu trong vùng soạn thảo (kể cả không
              phải chính input đó) sẽ khiến trình duyệt tự chuyển focus sang input ẩn đó — rớt
              caret/selection khỏi editor ngay khi vừa bấm vào, người dùng thấy như bị "undo". Đã xác
              minh qua test độc lập: click vào <div contenteditable> trong <label> bao 1 <input> luôn
              kích hoạt "focusin" sang input dù không click trực tiếp vào nó. */}
          <div className="flex flex-col gap-1.5 text-sm text-zinc-700">
            Nội dung
            <RichTextEditor value={contentHtml} onChange={setContentHtml} />
          </div>
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
            {initial?.slug &&
              (status === "PUBLISHED" ? (
                <a
                  href={`/bai-viet/${initial.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-[#1d3557] hover:underline"
                >
                  Xem bài viết →
                </a>
              ) : (
                <span
                  title="Chỉ xem được sau khi bài viết đã Xuất bản"
                  className="text-xs text-zinc-400"
                >
                  Xem bài viết (cần Xuất bản trước)
                </span>
              ))}
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

          <div className="flex flex-col gap-1.5 text-sm text-zinc-700">
            Tag
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => {
                  const active = tagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.id)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "border-[#1d3557] bg-[#1d3557] text-white"
                          : "border-zinc-300 text-zinc-600 hover:border-[#1d3557] hover:text-[#1d3557]"
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex gap-1.5">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Nhập tên tag mới rồi Enter..."
                disabled={creatingTag}
                className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={creatingTag || !tagInput.trim()}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                {creatingTag ? "..." : "Thêm"}
              </button>
            </div>
          </div>

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

          <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
            JSON-LD tuỳ chỉnh (nâng cao)
            <textarea
              value={jsonLd}
              onChange={(e) => setJsonLd(e.target.value)}
              rows={4}
              placeholder='Để trống = tự sinh (schema.org/Article). Nhập JSON hợp lệ để ghi đè, vd: {"@context":"https://schema.org",...}'
              className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
            />
            <span className="text-xs text-zinc-400">
              Dữ liệu có cấu trúc cho Google (rich snippet) — để trống thì hệ thống tự tạo từ tiêu
              đề/tóm tắt/ảnh đại diện/tác giả.
            </span>
          </label>

          <DownloadConfigPanel postId={initial?.id} />
        </div>
      </div>
    </div>
  );
}
