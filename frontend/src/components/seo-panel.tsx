const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

// Panel SEO trong trình soạn bài (UC14, wireframe #09) — đếm ký tự + xem trước snippet Google.
export function SeoPanel({
  metaTitle,
  onMetaTitleChange,
  metaDescription,
  onMetaDescriptionChange,
  canonicalUrl,
  onCanonicalUrlChange,
  fallbackTitle,
  fallbackDescription,
  previewPath,
}: {
  metaTitle: string;
  onMetaTitleChange: (value: string) => void;
  metaDescription: string;
  onMetaDescriptionChange: (value: string) => void;
  canonicalUrl: string;
  onCanonicalUrlChange: (value: string) => void;
  fallbackTitle: string;
  fallbackDescription: string;
  previewPath: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">SEO</p>

      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        <span className="flex items-center justify-between">
          Meta title
          <span className="font-mono text-xs text-zinc-400">
            {metaTitle.length}/{TITLE_LIMIT}
          </span>
        </span>
        <input
          value={metaTitle}
          maxLength={70}
          onChange={(e) => onMetaTitleChange(e.target.value)}
          placeholder={fallbackTitle}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        <span className="flex items-center justify-between">
          Meta description
          <span className="font-mono text-xs text-zinc-400">
            {metaDescription.length}/{DESCRIPTION_LIMIT}
          </span>
        </span>
        <textarea
          value={metaDescription}
          maxLength={180}
          rows={3}
          onChange={(e) => onMetaDescriptionChange(e.target.value)}
          placeholder={fallbackDescription}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Canonical URL (tuỳ chọn)
        <input
          value={canonicalUrl}
          onChange={(e) => onCanonicalUrlChange(e.target.value)}
          placeholder="https://khomanguon.vn/..."
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        />
      </label>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-zinc-500">Xem trước Google:</p>
        <div className="rounded-md border border-zinc-200 bg-white p-3">
          <p className="truncate text-base text-[#1a0dab]">
            {metaTitle || fallbackTitle || "Tiêu đề bài viết"}
          </p>
          <p className="truncate text-xs text-[#006621]">khomanguon.vn{previewPath}</p>
          <p className="line-clamp-2 text-xs text-zinc-600">
            {metaDescription || fallbackDescription || "Mô tả bài viết sẽ hiển thị ở đây..."}
          </p>
        </div>
      </div>
    </div>
  );
}
