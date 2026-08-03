"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError, API_URL } from "@/lib/api";
import { formatFileSize } from "@/lib/format";
import type { MediaFile, MediaFileListResponse } from "@/lib/types";
import { ErrorBanner, SuccessBanner } from "@/components/ui";

const PAGE_SIZE = 24;

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function absoluteUrl(url: string): string {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

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

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const loadFiles = useCallback(() => {
    setFetching(true);
    setError(null);
    const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (q) query.set("q", q);
    apiFetch<MediaFileListResponse>(`/media?${query.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"))
      .finally(() => setFetching(false));
  }, [page, q]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadFiles đặt cờ loading đồng bộ trước khi gọi API, đúng chủ đích (giống tep-cloud/page.tsx)
    if (user) loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page, q]);

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
        await apiFetch<MediaFile>("/media", { method: "POST", body: formData });
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
    if (!confirm(`Xoá "${file.originalName}"? Không thể hoàn tác.`)) return;
    setError(null);
    try {
      await apiFetch(`/media/${file.id}`, { method: "DELETE" });
      if (selected?.id === file.id) setSelected(null);
      loadFiles();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleCopyUrl(file: MediaFile) {
    await navigator.clipboard.writeText(absoluteUrl(file.url));
    setMessage(`Đã copy URL: ${file.originalName}`);
    setTimeout(() => setMessage(null), 2000);
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }

  return (
    <div className="flex w-full flex-col gap-4 px-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Thư viện Media</h1>
          <p className="text-sm text-zinc-500">Quản lý ảnh đã tải lên — tương tự Media Library của WordPress.</p>
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

      <div className="flex gap-4">
        <div className="flex-1">
          {fetching ? (
            <p className="px-4 py-10 text-center text-sm text-zinc-400">Đang tải...</p>
          ) : items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
              {q ? "Không tìm thấy tệp nào khớp." : "Chưa có tệp media nào — bấm \"Tải tệp lên\" để bắt đầu."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => setSelected(file)}
                  className={`group flex flex-col overflow-hidden rounded-md border text-left transition-colors ${
                    selected?.id === file.id
                      ? "border-[#1d3557] ring-1 ring-[#1d3557]"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex aspect-square items-center justify-center bg-zinc-100">
                    {isImage(file.mimeType) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={absoluteUrl(file.url)}
                        alt={file.originalName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl" aria-hidden>
                        📄
                      </span>
                    )}
                  </div>
                  <p className="truncate px-2 py-1.5 text-xs text-zinc-600" title={file.originalName}>
                    {file.originalName}
                  </p>
                </button>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-6 text-sm">
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
        </div>

        {selected && (
          <aside className="w-72 flex-none rounded-md border border-zinc-200 p-4">
            <div className="mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-md bg-zinc-100">
              {isImage(selected.mimeType) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={absoluteUrl(selected.url)}
                  alt={selected.originalName}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-4xl" aria-hidden>
                  📄
                </span>
              )}
            </div>
            <p className="break-words text-sm font-medium text-zinc-900">{selected.originalName}</p>
            <dl className="mt-2 flex flex-col gap-1 text-xs text-zinc-500">
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
            <div className="mt-3 flex gap-2">
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
          </aside>
        )}
      </div>
    </div>
  );
}
