"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { formatFileSize } from "@/lib/format";
import type { CloudFile, DownloadLinkPublic, StorageProvider } from "@/lib/types";

// "Download Config" — cấu hình link tải trả phí gắn theo bài viết (Cloud Storage + Key File + @Cash),
// khớp bố cục trang quản trị v1 cũ. Hỗ trợ NHIỀU link/bài (đổi thiết kế — trước đây chỉ 1 link
// "chính"/bài) — mỗi link là 1 hàng, mở rộng sửa/lưu/xoá riêng, giống WidgetEditPanel.
export function DownloadConfigPanel({ postId }: { postId?: string }) {
  const [providers, setProviders] = useState<StorageProvider[]>([]);
  const [links, setLinks] = useState<DownloadLinkPublic[]>([]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!postId) return;
    apiFetch<DownloadLinkPublic[]>(`/posts/${postId}/download-links`)
      .then(setLinks)
      .catch(() => setLinks([]));
  }, [postId]);

  useEffect(() => {
    apiFetch<StorageProvider[]>("/storage-providers")
      .then((all) => setProviders(all.filter((p) => p.type !== "MAILJET")))
      .catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleDelete(link: DownloadLinkPublic) {
    if (!confirm(`Xoá link tải "${link.label}"?`)) return;
    setError(null);
    try {
      await apiFetch(`/download-links/${link.id}`, { method: "DELETE" });
      if (editingId === link.id) setEditingId(null);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Download Config</p>
        {postId && (
          <button
            type="button"
            onClick={() => setEditingId("new")}
            className="text-xs font-medium text-[#1d3557] hover:underline"
          >
            + Thêm link tải
          </button>
        )}
      </div>

      {!postId ? (
        <p className="text-xs text-zinc-400">Lưu bài viết trước để cấu hình link tải.</p>
      ) : (
        <>
          {error && <p className="text-xs text-red-600">{error}</p>}

          {links.length === 0 && editingId !== "new" && (
            <p className="text-xs text-zinc-400">Chưa có link tải nào cho bài viết này.</p>
          )}

          {links.map((link) =>
            editingId === link.id ? (
              <DownloadLinkForm
                key={link.id}
                postId={postId}
                link={link}
                providers={providers}
                onCancel={() => setEditingId(null)}
                onSaved={() => {
                  setEditingId(null);
                  reload();
                }}
              />
            ) : (
              <div
                key={link.id}
                className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-800">{link.label}</p>
                  <p className="truncate font-mono text-xs text-zinc-400">
                    {link.objectKey} · {link.priceP > 0 ? `${link.priceP} $P` : "Miễn phí"}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingId(link.id)}
                    className="rounded px-2 py-0.5 text-xs font-medium text-[#1d3557] hover:bg-zinc-100"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(link)}
                    className="rounded px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-zinc-100"
                  >
                    Xoá
                  </button>
                </div>
              </div>
            ),
          )}

          {editingId === "new" && (
            <DownloadLinkForm
              postId={postId}
              link={null}
              providers={providers}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null);
                reload();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function DownloadLinkForm({
  postId,
  link,
  providers,
  onCancel,
  onSaved,
}: {
  postId: string;
  link: DownloadLinkPublic | null;
  providers: StorageProvider[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [storageProviderId, setStorageProviderId] = useState(
    () => providers.find((p) => p.isDefault)?.id || providers[0]?.id || "",
  );
  const [objectKey, setObjectKey] = useState(link?.objectKey ?? "");
  const [priceP, setPriceP] = useState(link?.priceP ?? 0);
  const [label, setLabel] = useState(link?.label ?? "");
  const [sizeBytes, setSizeBytes] = useState<number | null>(link?.sizeBytes ?? null);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Tự động dò dung lượng thật từ bucket thay vì bắt admin gõ tay — khớp đúng object key đã nhập,
  // tránh tình trạng quên nhập nên "Dung lượng" luôn hiện "—" ở trang chi tiết bài viết.
  async function handleDetectSize() {
    if (!storageProviderId || !objectKey.trim()) {
      setError("Chọn Cloud Storage và nhập Key File trước khi dò dung lượng.");
      return;
    }
    setError(null);
    setDetecting(true);
    try {
      const files = await apiFetch<CloudFile[]>(`/storage-providers/${storageProviderId}/files`);
      const match = files.find((f) => f.key === objectKey.trim());
      if (!match) {
        setError("Không tìm thấy file này trong bucket — kiểm tra lại Key File.");
        return;
      }
      setSizeBytes(match.sizeBytes);
      setMessage(`Đã dò được dung lượng: ${formatFileSize(match.sizeBytes)}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra khi dò dung lượng");
    } finally {
      setDetecting(false);
    }
  }

  async function handleSave() {
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
      const payload = {
        label: label.trim() || objectKey.trim(),
        storageProviderId,
        objectKey: objectKey.trim(),
        sizeBytes: sizeBytes ?? undefined,
        priceP,
      };
      if (link) {
        await apiFetch(`/download-links/${link.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/posts/${postId}/download-links`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-[#1d3557]/30 bg-[#1d3557]/5 p-3">
      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Tên hiển thị (để trống dùng Key File)
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        />
      </label>

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
        Dung lượng (byte)
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={sizeBytes ?? ""}
            onChange={(e) => setSizeBytes(e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0))}
            placeholder="Chưa có — bấm Dò dung lượng hoặc nhập tay"
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          />
          <button
            type="button"
            onClick={handleDetectSize}
            disabled={detecting}
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {detecting ? "Đang dò..." : "Dò dung lượng"}
          </button>
        </div>
        <span className="text-xs text-zinc-400">
          {sizeBytes ? `≈ ${formatFileSize(sizeBytes)}` : "Hiển thị ở khối \"Dung lượng\" trang chi tiết bài viết — để trống sẽ hiện dấu \"—\"."}
        </span>
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

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md border border-[#1d3557] px-3 py-1.5 text-sm font-medium text-[#1d3557] hover:bg-[#1d3557]/5 disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu link tải"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100"
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}
