"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  File as FileIcon,
  Loader2,
  RotateCcw,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { formatFileSize } from "@/lib/format";
import type { StorageProvider } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

type UploadStatus = "queued" | "signing" | "uploading" | "success" | "error" | "cancelled";

interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number; // 0-100
  key: string | null;
  error: string | null;
  xhr: XMLHttpRequest | null;
}

const MAX_CONCURRENT = 3;
// Giới hạn kỹ thuật của presigned PUT single-object (S3/R2 đều theo chuẩn S3 API) — file lớn hơn
// phải chia multipart, chưa hỗ trợ ở bản này nên chặn sớm thay vì để bucket từ chối giữa chừng.
const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function UploadCloudFilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [providers, setProviders] = useState<StorageProvider[]>([]);
  const [providerId, setProviderId] = useState("");
  const [folder, setFolder] = useState("");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<UploadItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<StorageProvider[]>("/storage-providers")
      .then((all) => {
        const list = all.filter((p) => p.type !== "MAILJET");
        setProviders(list);
        setProviderId((current) => current || list[0]?.id || "");
      })
      .catch((err) => {
        setProviders([]);
        setLoadError(err instanceof ApiError ? err.message : "Không tải được danh sách provider");
      });
  }, [user]);

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  // Chạy 1 upload: xin presigned URL từ backend (request nhỏ, apiFetch bình thường) rồi PUT thẳng
  // file lên R2/S3 bằng XMLHttpRequest thô — không qua backend nên backend không giữ request nào
  // mở suốt lúc tải (tránh timeout với file nặng), và XHR cho progress event mà fetch() không có.
  const runUpload = useCallback(
    (item: UploadItem, activeProviderId: string, activeFolder: string) => {
      updateItem(item.id, { status: "signing", error: null });
      apiFetch<{ url: string; key: string }>(
        `/storage-providers/${activeProviderId}/files/presign-upload`,
        {
          method: "POST",
          body: JSON.stringify({ filename: item.file.name, folder: activeFolder || undefined }),
        },
      )
        .then(({ url, key }) => {
          // Đọc lại state mới nhất — người dùng có thể đã bấm Huỷ trong lúc chờ xin URL.
          const current = itemsRef.current.find((it) => it.id === item.id);
          if (!current || current.status === "cancelled") return;

          const xhr = new XMLHttpRequest();
          xhr.open("PUT", url);
          xhr.setRequestHeader("Content-Type", item.file.type || "application/octet-stream");
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              updateItem(item.id, { progress: Math.round((e.loaded / e.total) * 100) });
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              updateItem(item.id, { status: "success", progress: 100, key });
            } else {
              updateItem(item.id, {
                status: "error",
                error: `Bucket từ chối (HTTP ${xhr.status}) — kiểm tra lại quyền ghi của key/secret.`,
              });
            }
          };
          xhr.onerror = () => {
            updateItem(item.id, { status: "error", error: "Lỗi mạng lúc tải lên, thử lại." });
          };
          xhr.onabort = () => {
            updateItem(item.id, { status: "cancelled" });
          };
          updateItem(item.id, { status: "uploading", xhr });
          xhr.send(item.file);
        })
        .catch((err) => {
          updateItem(item.id, {
            status: "error",
            error: err instanceof ApiError ? err.message : "Không xin được URL tải lên",
          });
        });
    },
    [updateItem],
  );

  // Hàng đợi giới hạn số upload chạy song song (MAX_CONCURRENT) — kéo thả 20 file cùng lúc không
  // dí băng thông trình duyệt vào 1 request khổng lồ hay mở tràn lan 20 kết nối song song.
  useEffect(() => {
    const uploading = items.filter((it) => it.status === "uploading" || it.status === "signing");
    const queued = items.filter((it) => it.status === "queued");
    const slots = MAX_CONCURRENT - uploading.length;
    if (slots <= 0 || queued.length === 0 || !providerId) return;
    queued.slice(0, slots).forEach((it) => runUpload(it, providerId, folder));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, providerId]);

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    const next: UploadItem[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        next.push({
          id: newId(),
          file,
          status: "error",
          progress: 0,
          key: null,
          error: `File vượt quá ${formatFileSize(MAX_FILE_BYTES)} — chưa hỗ trợ multipart upload.`,
          xhr: null,
        });
        continue;
      }
      next.push({
        id: newId(),
        file,
        status: "queued",
        progress: 0,
        key: null,
        error: null,
        xhr: null,
      });
    }
    setItems((prev) => [...prev, ...next]);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  function handleCancel(item: UploadItem) {
    if (item.status === "uploading" && item.xhr) {
      item.xhr.abort();
    } else if (item.status === "queued" || item.status === "signing") {
      updateItem(item.id, { status: "cancelled" });
    }
  }

  function handleRetry(item: UploadItem) {
    updateItem(item.id, { status: "queued", progress: 0, error: null, xhr: null, key: null });
  }

  function handleRemove(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function handleCopyKey(key: string) {
    await navigator.clipboard.writeText(key);
  }

  function clearFinished() {
    setItems((prev) => prev.filter((it) => it.status !== "success"));
  }

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)) {
    return <ForbiddenPage />;
  }

  const total = items.length;
  const doneCount = items.filter((it) => it.status === "success").length;
  const activeCount = items.filter((it) => it.status === "uploading" || it.status === "signing").length;

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4 px-8 py-8">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/quan-tri/tep-cloud" className="flex items-center gap-1 hover:text-[#1d3557]">
          <ChevronLeft size={15} strokeWidth={1.75} aria-hidden />
          Quản lý File Cloud
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-zinc-900">Upload File Cloud</h1>
      <p className="text-sm text-zinc-500">
        Tải file lên thẳng bucket R2/S3 — trình duyệt gửi trực tiếp tới provider, không qua server
        trung gian nên không sợ timeout với file nặng.
      </p>

      <ErrorBanner message={loadError} />

      {providers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Chưa có storage provider nào — vào Cài đặt Storage để thêm trước.
        </p>
      ) : (
        <>
          <div className="flex gap-1 border-b border-zinc-200 font-mono text-sm">
            {providers.map((p) => (
              <button
                key={p.id}
                onClick={() => setProviderId(p.id)}
                className={`border-b-2 px-3 py-2 ${
                  providerId === p.id
                    ? "border-[#1d3557] font-semibold text-[#1d3557]"
                    : "border-transparent text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
            Thư mục con (tuỳ chọn)
            <input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="vd: game-pc/2026 — để trống sẽ tự lưu theo ngày"
              className="max-w-sm rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
            />
          </label>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
              dragActive
                ? "border-[#1d3557] bg-[#1d3557]/5"
                : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50"
            }`}
          >
            <UploadCloud
              size={34}
              strokeWidth={1.5}
              className={dragActive ? "text-[#1d3557]" : "text-zinc-400"}
              aria-hidden
            />
            <p className="text-sm font-medium text-zinc-700">
              Kéo thả file vào đây, hoặc <span className="text-[#1d3557] underline">chọn file</span>
            </p>
            <p className="text-xs text-zinc-400">
              Hỗ trợ nhiều file cùng lúc · tối đa {formatFileSize(MAX_FILE_BYTES)}/file
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
          </div>

          {total > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-600">
                  {activeCount > 0
                    ? `Đang tải ${activeCount} file...`
                    : doneCount === total
                      ? "Đã tải xong toàn bộ."
                      : `${doneCount}/${total} hoàn tất`}
                </p>
                {doneCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFinished}
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-800 hover:underline"
                  >
                    Xoá khỏi danh sách các file đã xong
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <UploadRow
                    key={item.id}
                    item={item}
                    onCancel={() => handleCancel(item)}
                    onRetry={() => handleRetry(item)}
                    onRemove={() => handleRemove(item.id)}
                    onCopyKey={() => handleCopyKey(item.key!)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UploadRow({
  item,
  onCancel,
  onRetry,
  onRemove,
  onCopyKey,
}: {
  item: UploadItem;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
  onCopyKey: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5">
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-zinc-100">
        {item.status === "success" ? (
          <CheckCircle2 size={18} className="text-emerald-600" aria-hidden />
        ) : item.status === "error" ? (
          <XCircle size={18} className="text-red-500" aria-hidden />
        ) : item.status === "uploading" || item.status === "signing" ? (
          <Loader2 size={18} className="animate-spin text-[#1d3557]" aria-hidden />
        ) : (
          <FileIcon size={18} className="text-zinc-400" aria-hidden />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-zinc-800" title={item.file.name}>
            {item.file.name}
          </p>
          <span className="shrink-0 font-mono text-xs text-zinc-400">
            {formatFileSize(item.file.size)}
          </span>
        </div>

        {(item.status === "uploading" || item.status === "signing") && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-[#1d3557] transition-[width] duration-200"
              style={{ width: `${item.status === "signing" ? 3 : Math.max(item.progress, 3)}%` }}
            />
          </div>
        )}

        {item.status === "error" && item.error && (
          <p className="text-xs text-red-600">{item.error}</p>
        )}
        {item.status === "cancelled" && <p className="text-xs text-zinc-400">Đã huỷ.</p>}
        {item.status === "success" && item.key && (
          <p className="truncate font-mono text-xs text-zinc-400" title={item.key}>
            {item.key}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {item.status === "success" && item.key && (
          <button
            type="button"
            onClick={() => {
              onCopyKey();
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="rounded px-2 py-1 text-xs font-medium text-[#1d3557] hover:bg-zinc-100"
          >
            {copied ? "Đã copy ✓" : "Copy key"}
          </button>
        )}
        {item.status === "error" && (
          <button
            type="button"
            onClick={onRetry}
            title="Thử lại"
            className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          >
            <RotateCcw size={15} aria-hidden />
          </button>
        )}
        {(item.status === "uploading" || item.status === "queued" || item.status === "signing") && (
          <button
            type="button"
            onClick={onCancel}
            title="Huỷ"
            className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          >
            <X size={15} aria-hidden />
          </button>
        )}
        {(item.status === "success" || item.status === "error" || item.status === "cancelled") && (
          <button
            type="button"
            onClick={onRemove}
            title="Bỏ khỏi danh sách"
            className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X size={15} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
