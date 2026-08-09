"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { formatFileSize } from "@/lib/format";
import { toAbsoluteUploadUrl as absoluteUrl } from "@/lib/upload";
import { LOCAL_SOURCE, useMediaStorageTargets } from "@/lib/use-media-storage-targets";
import type { MediaFile, MediaFileListResponse } from "@/lib/types";
import { ErrorBanner, SuccessBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

const PAGE_SIZE = 24;

export default function MediaLibraryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<MediaFile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<MediaFile | null>(null);
  const { targets, activeSource, setActiveSource } = useMediaStorageTargets();

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadFiles đặt cờ loading đồng bộ trước khi gọi API, đúng chủ đích (giống tep-cloud/page.tsx)
    if (user) loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page, q, activeSource]);

  function handleTabChange(source: string) {
    setActiveSource(source);
    setPage(1);
    setSelected(null);
  }

  // Đóng modal xem chi tiết bằng phím Esc.
  useEffect(() => {
    if (!selected) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selected]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQ(searchInput.trim());
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setError(null);
    setMessage(null);
    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        if (activeSource !== LOCAL_SOURCE) formData.append("storageProviderId", activeSource);
        await apiFetch("/media", { method: "POST", body: formData });
      }
      setMessage(`Đã tải lên ${files.length} tệp.`);
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

  async function handleDelete(file: MediaFile) {
    if (!confirm(`Xoá "${file.fileName}"? Không thể hoàn tác.`)) return;
    setError(null);
    try {
      const query = new URLSearchParams({ path: file.path });
      if (activeSource !== LOCAL_SOURCE) query.set("storageProviderId", activeSource);
      await apiFetch(`/media?${query.toString()}`, { method: "DELETE" });
      if (selected?.path === file.path) setSelected(null);
      loadFiles();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleCopyUrl(file: MediaFile) {
    await navigator.clipboard.writeText(absoluteUrl(file.url));
    setMessage(`Đã copy URL: ${file.fileName}`);
    setTimeout(() => setMessage(null), 2000);
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.MEDIA_MANAGE)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Thư viện Media</h1>
          <p className="text-sm text-zinc-500">
            Quản lý ảnh đã tải lên (uploads/posts/yyyy/mm/dd) — tương tự Media Library của WordPress.
          </p>
        </div>
        <label className="w-fit cursor-pointer rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a]">
          {uploading ? "Đang tải lên..." : "＋ Tải tệp lên"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

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

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Tìm theo tên tệp..."
          className="flex-1 max-w-sm rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        />
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Tìm
        </button>
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setSearchInput("");
              setPage(1);
            }}
            className="rounded-md px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            Xoá lọc
          </button>
        )}
      </form>

      {fetching ? (
        <p className="px-4 py-10 text-center text-sm text-zinc-400">Đang tải...</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          {q ? "Không tìm thấy tệp nào khớp." : 'Chưa có tệp media nào — bấm "Tải tệp lên" để bắt đầu.'}
        </p>
      ) : (
        // Grid ảnh thumbnail cùng kích thước (aspect-square + object-cover) kiểu WordPress —
        // bấm vào mở modal xem chi tiết thay vì panel bên cạnh.
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => setSelected(file)}
              className="group flex aspect-square overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 transition-colors hover:border-[#1d3557]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={absoluteUrl(file.url)}
                alt={file.fileName}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2 text-sm">
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

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="flex w-full max-w-3xl flex-col gap-4 overflow-hidden rounded-lg bg-white p-4 sm:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-1 items-center justify-center overflow-hidden rounded-md bg-zinc-100 sm:max-w-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={absoluteUrl(selected.url)}
                alt={selected.fileName}
                className="max-h-[70vh] w-full object-contain"
              />
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-64">
              <div className="flex items-start justify-between gap-2">
                <p className="break-words text-sm font-medium text-zinc-900">{selected.fileName}</p>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Đóng"
                  className="flex-none rounded px-1.5 py-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  ✕
                </button>
              </div>
              <dl className="flex flex-col gap-1 text-xs text-zinc-500">
                <div className="flex justify-between">
                  <dt>Dung lượng</dt>
                  <dd>{formatFileSize(selected.sizeBytes)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Loại</dt>
                  <dd>{selected.mimeType}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Ngày tải lên</dt>
                  <dd>{new Date(selected.createdAt).toLocaleString("vi-VN")}</dd>
                </div>
                {selected.uploadedBy && (
                  <div className="flex justify-between">
                    <dt>Người tải</dt>
                    <dd>{selected.uploadedBy.displayName}</dd>
                  </div>
                )}
              </dl>
              <p className="break-all text-xs text-zinc-400">{selected.path}</p>
              <div className="mt-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyUrl(selected)}
                  className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Copy URL
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(selected)}
                  className="flex-1 rounded-md border border-red-200 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Xoá
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
