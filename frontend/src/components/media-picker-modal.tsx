"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { toAbsoluteUploadUrl } from "@/lib/upload";
import { LOCAL_SOURCE, useMediaStorageTargets } from "@/lib/use-media-storage-targets";
import type { MediaFile, MediaFileListResponse } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";

const PAGE_SIZE = 24;

// Modal chọn ảnh kiểu WordPress "Add Media" — cùng nguồn dữ liệu với trang quản trị
// /admin/media-library (GET/POST /media, quyền post.create — xem media.controller.ts) nên ảnh tải
// lên từ đâu cũng thấy lại được ở khắp nơi. Dùng chung cho 3 chỗ cần chọn ảnh: chèn ảnh nội dung bài
// viết (rich-text-editor.tsx, multiple=true, chèn nhiều ảnh 1 lượt), chọn Ảnh đại diện/Ảnh OG
// (image-upload-field.tsx, multiple=false).
export function MediaPickerModal({
  open,
  multiple = false,
  onClose,
  onSelect,
}: {
  open: boolean;
  multiple?: boolean;
  onClose: () => void;
  onSelect: (urls: string[]) => void;
}) {
  const [items, setItems] = useState<MediaFile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [syncedOpen, setSyncedOpen] = useState(open);
  const { targets, activeSource, setActiveSource } = useMediaStorageTargets();

  const loadFiles = useCallback(() => {
    setFetching(true);
    setError(null);
    const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (q) query.set("q", q);
    if (activeSource !== LOCAL_SOURCE) query.set("storageProviderId", activeSource);
    apiFetch<MediaFileListResponse>(`/media?${query.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"))
      .finally(() => setFetching(false));
  }, [page, q, activeSource]);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadFiles đặt cờ loading đồng bộ trước khi gọi API, đúng chủ đích (giống media-library/page.tsx)
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, page, q, activeSource]);

  function handleTabChange(source: string) {
    setActiveSource(source);
    setPage(1);
    setSelectedPaths(new Set());
  }

  // Mỗi lần mở modal reset về trạng thái sạch — không giữ lại lựa chọn/tìm kiếm của lần mở trước.
  // Cập nhật ngay trong lúc render (theo khuyến nghị React thay vì setState trong useEffect, tránh
  // render thừa) — cùng pattern đã dùng ở admin-sidebar.tsx.
  if (open !== syncedOpen) {
    setSyncedOpen(open);
    if (open) {
      setSelectedPaths(new Set());
      setPage(1);
      setQ("");
      setSearchInput("");
    }
  }

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        if (activeSource !== LOCAL_SOURCE) formData.append("storageProviderId", activeSource);
        await apiFetch("/media", { method: "POST", body: formData });
      }
      setPage(1);
      setQ("");
      setSearchInput("");
      loadFiles();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tải lên thất bại");
    } finally {
      setUploading(false);
    }
  }

  function toggleSelect(file: MediaFile) {
    setSelectedPaths((prev) => {
      if (!multiple) return prev.has(file.path) ? new Set() : new Set([file.path]);
      const next = new Set(prev);
      if (next.has(file.path)) next.delete(file.path);
      else next.add(file.path);
      return next;
    });
  }

  function handleConfirm() {
    const urls = items
      .filter((f) => selectedPaths.has(f.path))
      .map((f) => toAbsoluteUploadUrl(f.url));
    if (urls.length === 0) return;
    onSelect(urls);
    onClose();
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQ(searchInput.trim());
  }

  if (!open) return null;

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col gap-3 overflow-hidden rounded-lg bg-white p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Chọn ảnh từ Thư viện Media</h2>
            <p className="text-xs text-zinc-500">
              {multiple ? "Chọn 1 hoặc nhiều ảnh để chèn." : "Chọn 1 ảnh."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="w-fit cursor-pointer rounded-md bg-[#1d3557] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#16294a]">
              {uploading ? "Đang tải lên..." : "＋ Tải ảnh lên"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-zinc-200">
          <button
            type="button"
            onClick={() => handleTabChange(LOCAL_SOURCE)}
            className={`px-3 py-1.5 text-sm font-medium ${
              activeSource === LOCAL_SOURCE
                ? "border-b-2 border-[#1d3557] text-[#1d3557]"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            Local
          </button>
          {targets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
              className={`px-3 py-1.5 text-sm font-medium ${
                activeSource === t.id
                  ? "border-b-2 border-[#1d3557] text-[#1d3557]"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {t.type}
            </button>
          ))}
        </div>

        <ErrorBanner message={error} />

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo tên tệp..."
            className="max-w-sm flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          />
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Tìm
          </button>
        </form>

        <div className="flex-1 overflow-y-auto">
          {fetching ? (
            <p className="px-4 py-10 text-center text-sm text-zinc-400">Đang tải...</p>
          ) : items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
              {q ? "Không tìm thấy tệp nào khớp." : 'Chưa có tệp media nào — bấm "Tải ảnh lên" để bắt đầu.'}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {items.map((file) => {
                const isSelected = selectedPaths.has(file.path);
                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => toggleSelect(file)}
                    title={file.fileName}
                    className={`group relative flex aspect-square overflow-hidden rounded-md border-2 bg-zinc-100 transition-colors ${
                      isSelected ? "border-[#1d3557]" : "border-transparent hover:border-zinc-300"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={toAbsoluteUploadUrl(file.url)}
                      alt={file.fileName}
                      className="h-full w-full object-cover"
                    />
                    {isSelected && (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1d3557] text-xs text-white">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
            >
              ‹ Trước
            </button>
            <span className="text-zinc-500">
              Trang {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
            >
              Sau ›
            </button>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-zinc-200 pt-3">
          <span className="text-xs text-zinc-500">
            {selectedPaths.size > 0 ? `Đã chọn ${selectedPaths.size} ảnh` : "Chưa chọn ảnh nào"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedPaths.size === 0}
              className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
            >
              {multiple ? "Chèn vào bài viết" : "Chọn ảnh"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
