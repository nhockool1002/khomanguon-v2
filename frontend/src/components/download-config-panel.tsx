"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { DownloadLinkPublic, StorageProvider } from "@/lib/types";

// "Download Config" — cấu hình link tải trả phí gắn theo bài viết (Cloud Storage + Key File + @Cash),
// khớp bố cục trang quản trị v1 cũ. Chỉ dùng được sau khi bài viết đã lưu (cần postId làm FK).
export function DownloadConfigPanel({ postId }: { postId?: string }) {
  const [providers, setProviders] = useState<StorageProvider[]>([]);
  const [storageProviderId, setStorageProviderId] = useState("");
  const [objectKey, setObjectKey] = useState("");
  const [priceP, setPriceP] = useState(0);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<StorageProvider[]>("/storage-providers")
      .then((all) => {
        // MAILJET không phải file storage — không dùng được cho download link.
        const list = all.filter((p) => p.type !== "MAILJET");
        setProviders(list);
        setStorageProviderId((current) => current || list.find((p) => p.isDefault)?.id || list[0]?.id || "");
      })
      .catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    if (!postId) return;
    apiFetch<DownloadLinkPublic | null>(`/posts/${postId}/download-link`)
      .then((link) => {
        if (!link) return;
        setObjectKey(link.objectKey);
        setPriceP(link.priceP);
        setLabel(link.label);
      })
      .catch(() => {});
  }, [postId]);

  async function handleSave() {
    if (!postId) return;
    setError(null);
    setMessage(null);
    if (!storageProviderId) {
      setError("Chưa có Storage Provider nào — tạo ở Admin > Cài đặt Storage trước.");
      return;
    }
    if (!objectKey.trim()) {
      setError("Key File không được để trống");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/posts/${postId}/download-link`, {
        method: "PUT",
        body: JSON.stringify({
          label: label.trim() || objectKey.trim(),
          storageProviderId,
          objectKey: objectKey.trim(),
          priceP,
        }),
      });
      setMessage("Đã lưu cấu hình link tải.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Download Config</p>

      {!postId ? (
        <p className="text-xs text-zinc-400">Lưu bài viết trước để cấu hình link tải.</p>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Cloud Storage
            <select
              value={storageProviderId}
              onChange={(e) => setStorageProviderId(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
            >
              <option value="">— Chọn provider —</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.type})
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Key File
            <input
              value={objectKey}
              onChange={(e) => setObjectKey(e.target.value)}
              placeholder="source-code/example.zip"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
            />
            <span className="text-xs text-zinc-400">Nhập object key/path tương ứng provider đã chọn.</span>
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            $P
            <input
              type="number"
              min={0}
              value={priceP}
              onChange={(e) => setPriceP(Math.max(0, Number(e.target.value) || 0))}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
            />
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}
          {message && <p className="text-xs text-emerald-600">{message}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md border border-[#1d3557] px-3 py-1.5 text-sm font-medium text-[#1d3557] hover:bg-[#1d3557]/5 disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu Download Config"}
          </button>
        </>
      )}
    </div>
  );
}
