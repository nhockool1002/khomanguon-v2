"use client";

import { useEffect, useRef, useState } from "react";
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
import type { CloudUploadRecord, CloudUploadStatus } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";
import {
  MULTIPART_THRESHOLD_BYTES,
  useUploadQueue,
  type UploadItem,
  type UploadStatus,
} from "@/context/upload-queue-context";

// Trang này chỉ còn là lớp hiển thị thuần — toàn bộ state/logic hàng đợi nằm ở
// context/upload-queue-context.tsx (mount tại layout /quan-tri) để rời trang rồi quay lại vẫn giữ
// nguyên tiến độ. Bố cục 2 cột: trái = khu vực xử lý upload (hàng đợi hiện tại), phải = lịch sử
// upload đã lưu DB (nhiều admin cùng xem được, không chỉ localStorage của riêng máy đang dùng).
export default function UploadCloudFilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const {
    providers,
    providerId,
    setProviderId,
    folder,
    setFolder,
    items,
    loadError,
    historyVersion,
    addFiles,
    handleCancel,
    handleRetry,
    handleRemove,
    clearFinished,
  } = useUploadQueue();
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  async function handleCopyKey(key: string) {
    await navigator.clipboard.writeText(key);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)) {
    return <ForbiddenPage />;
  }

  const total = items.length;
  const doneCount = items.filter((it) => it.status === "success").length;
  const activeCount = items.filter(
    (it) => it.status === "uploading" || it.status === "signing" || it.status === "completing",
  ).length;

  return (
    <div className="flex w-full max-w-6xl flex-col gap-4 px-8 py-8">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/quan-tri/tep-cloud" className="flex items-center gap-1 hover:text-[#1d3557]">
          <ChevronLeft size={15} strokeWidth={1.75} aria-hidden />
          Quản lý File Cloud
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-zinc-900">Upload File Cloud</h1>
      <p className="text-sm text-zinc-500">
        Tải file lên thẳng bucket R2/S3 — trình duyệt gửi trực tiếp tới provider, không qua server
        trung gian nên không sợ timeout với file nặng. File trên {formatFileSize(MULTIPART_THRESHOLD_BYTES)}{" "}
        tự động chia phần (multipart) để tải song song, không giới hạn dung lượng. Có thể rời trang
        này trong lúc đang tải — hàng đợi vẫn tiếp tục chạy nền, quay lại xem tiếp ở đây.
      </p>

      <details className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <summary className="cursor-pointer font-medium">
          ⚠️ Upload lỗi mạng / lỗi CORS? Kiểm tra cấu hình CORS của bucket trước
        </summary>
        <div className="mt-2 flex flex-col gap-2 text-xs text-amber-800">
          <p>
            Trình duyệt PUT thẳng lên bucket (không qua server) nên bucket <strong>bắt buộc</strong> phải bật
            CORS cho đúng domain đang dùng, kèm <code>ExposeHeaders: [&quot;ETag&quot;]</code> (multipart cần đọc
            ETag từ response mỗi phần). Vào Cloudflare R2 → bucket → Settings → CORS Policy, dán cấu hình dạng:
          </p>
          <pre className="overflow-x-auto rounded-md bg-white p-3 font-mono text-[11px] text-zinc-700">
{`[
  {
    "AllowedOrigins": ["https://khomanguon-v2.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]`}
          </pre>
          <p>
            Thay đúng domain frontend production đang dùng vào <code>AllowedOrigins</code>. <strong>Lưu ý:</strong>{" "}
            dùng tường minh <code>&quot;AllowedHeaders&quot;: [&quot;content-type&quot;]</code> thay vì{" "}
            <code>[&quot;*&quot;]</code> — wildcard tuy đúng chuẩn S3 nhưng trên R2 thực tế không đáng tin cậy với
            presigned upload, đây là nguyên nhân phổ biến gây lỗi mạng dù CORS &quot;trông có vẻ đúng&quot;. Đây là
            cấu hình phía Cloudflare dashboard — <strong>không sửa được bằng code</strong>, phải tự đổi trên bucket.
            Nếu vẫn lỗi sau khi cấu hình CORS, mở DevTools (F12) → tab Console/Network lúc upload để xem lý do chặn
            thật (chữ ký SigV4 sai, DNS/endpoint sai...).
          </p>
        </div>
      </details>

      <ErrorBanner message={loadError} />

      {providers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Chưa có storage provider nào — vào Cài đặt Storage để thêm trước.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
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
                Hỗ trợ nhiều file cùng lúc · không giới hạn dung lượng
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
                      providerLabel={providers.find((p) => p.id === item.providerId)?.label}
                      onCancel={() => handleCancel(item)}
                      onRetry={() => handleRetry(item)}
                      onRemove={() => handleRemove(item.id)}
                      onCopyKey={() => handleCopyKey(item.key!)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <UploadHistoryPanel version={historyVersion} />
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<UploadStatus, string> = {
  queued: "Đang chờ...",
  signing: "Đang xin URL...",
  uploading: "Đang tải...",
  completing: "Đang ráp file...",
  success: "",
  error: "",
  cancelled: "Đã huỷ.",
};

function UploadRow({
  item,
  providerLabel,
  onCancel,
  onRetry,
  onRemove,
  onCopyKey,
}: {
  item: UploadItem;
  providerLabel?: string;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
  onCopyKey: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isBusy =
    item.status === "uploading" || item.status === "signing" || item.status === "completing";
  const partsSummary =
    item.parts && item.parts.length > 1
      ? `${item.parts.filter((p) => p.status === "success").length}/${item.parts.length} phần`
      : null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5">
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-zinc-100">
        {item.status === "success" ? (
          <CheckCircle2 size={18} className="text-emerald-600" aria-hidden />
        ) : item.status === "error" ? (
          <XCircle size={18} className="text-red-500" aria-hidden />
        ) : isBusy ? (
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

        {isBusy && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-[#1d3557] transition-[width] duration-200"
              style={{ width: `${item.status === "signing" ? 3 : Math.max(item.progress, 3)}%` }}
            />
          </div>
        )}

        {isBusy && (
          <p className="text-xs text-zinc-400">
            {STATUS_LABEL[item.status]}
            {partsSummary && ` · ${partsSummary}`}
            {providerLabel && ` · ${providerLabel}`}
          </p>
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
        {(isBusy || item.status === "queued") && (
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

const HISTORY_STATUS_LABEL: Record<CloudUploadStatus, string> = {
  SUCCESS: "Thành công",
  FAILED: "Thất bại",
  CANCELLED: "Đã huỷ",
};
const HISTORY_STATUS_COLOR: Record<CloudUploadStatus, string> = {
  SUCCESS: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-zinc-200 text-zinc-600",
};
const PAGE_SIZE = 20;

// Cột phải — lịch sử upload lưu DB (không chỉ localStorage) nên nhiều admin cùng xem được. Tự
// fetch lại mỗi khi context ghi thêm 1 bản ghi mới (prop "version" tăng dần, xem
// upload-queue-context.tsx) hoặc khi đổi trang.
function UploadHistoryPanel({ version }: { version: number }) {
  const [records, setRecords] = useState<CloudUploadRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ items: CloudUploadRecord[]; total: number }>(
      `/cloud-files/upload-history?page=${page}&limit=${PAGE_SIZE}`,
    )
      .then((res) => {
        setRecords(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [page, version]);

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Lịch sử upload</p>
      <ErrorBanner message={error} />
      {records.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Chưa có lần upload nào.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {records.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-1 rounded-md border border-zinc-200 bg-white px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-zinc-800" title={r.fileName}>
                  {r.fileName}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${HISTORY_STATUS_COLOR[r.status]}`}
                >
                  {HISTORY_STATUS_LABEL[r.status]}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span>{new Date(r.createdAt).toLocaleString("vi-VN")}</span>
                {r.sizeBytes !== null && <span>· {formatFileSize(r.sizeBytes)}</span>}
                {r.providerLabel && <span>· {r.providerLabel}</span>}
                {r.uploadedBy && <span>· {r.uploadedBy.displayName}</span>}
              </div>
              {r.errorMessage && (
                <p className="text-xs text-red-600" title={r.errorMessage}>
                  {r.errorMessage.slice(0, 120)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40"
          >
            ← Trước
          </button>
          <span className="text-zinc-500">
            Trang {page}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40"
          >
            Sau →
          </button>
        </div>
      )}
    </div>
  );
}
