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

type UploadStatus =
  | "queued"
  | "signing"
  | "uploading"
  | "completing"
  | "success"
  | "error"
  | "cancelled";

interface PartState {
  partNumber: number;
  start: number;
  end: number;
  status: "pending" | "uploading" | "success" | "error";
  uploadedBytes: number;
  eTag: string | null;
  xhr: XMLHttpRequest | null;
}

interface UploadItem {
  id: string;
  file: File;
  // Chụp lại provider/thư mục NGAY lúc thêm file — người dùng có thể đổi tab provider hoặc thư mục
  // trong lúc file khác vẫn đang tải, không được để việc đó ảnh hưởng ngược tới các item đã xếp hàng.
  providerId: string;
  folder: string;
  status: UploadStatus;
  progress: number; // 0-100, chỉ chạm mốc 100 khi thật sự xong (kể cả bước "ráp" multipart)
  key: string | null;
  error: string | null;
  xhr: XMLHttpRequest | null; // dùng cho đường PUT đơn
  // Chỉ có giá trị với file > MULTIPART_THRESHOLD_BYTES (xem buildParts).
  uploadId: string | null;
  parts: PartState[] | null;
}

const MAX_CONCURRENT = 3; // số FILE tải song song
const PART_CONCURRENCY = 3; // số PHẦN tải song song trong 1 file multipart

// Trần cứng của PutObject/presigned PUT đơn theo chuẩn S3 API (không phải giới hạn tự đặt) — file
// lớn hơn bắt buộc phải chia phần (multipart), nhỏ hơn hoặc bằng thì PUT thẳng 1 lần cho gọn.
const MULTIPART_THRESHOLD_BYTES = 5 * 1024 * 1024 * 1024;
const MIN_PART_BYTES = 5 * 1024 * 1024; // tối thiểu 5MB/phần theo yêu cầu S3 (trừ phần cuối)
const PREFERRED_PART_BYTES = 64 * 1024 * 1024; // cân bằng số request vs độ song song
const MAX_PARTS = 10000; // trần cứng số phần multipart của S3

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function choosePartSize(fileSize: number): number {
  const minNeeded = Math.ceil(fileSize / MAX_PARTS);
  return Math.max(MIN_PART_BYTES, PREFERRED_PART_BYTES, minNeeded);
}

function buildParts(file: File): PartState[] {
  const partSize = choosePartSize(file.size);
  const parts: PartState[] = [];
  let start = 0;
  let partNumber = 1;
  while (start < file.size) {
    const end = Math.min(start + partSize, file.size);
    parts.push({ partNumber, start, end, status: "pending", uploadedBytes: 0, eTag: null, xhr: null });
    start = end;
    partNumber += 1;
  }
  if (parts.length === 0) {
    // File 0 byte vẫn cần đúng 1 phần — multipart không chấp nhận danh sách phần rỗng.
    parts.push({ partNumber: 1, start: 0, end: 0, status: "pending", uploadedBytes: 0, eTag: null, xhr: null });
  }
  return parts;
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
  // Đánh dấu item đã được effect hàng đợi dispatch — cần thiết vì runSingleUpload/runMultipartUpload
  // gọi API thật (side effect không idempotent), còn cập nhật status "queued" -> "signing" là setState
  // BẤT ĐỒNG BỘ. Nếu effect hàng đợi chạy lại trước khi state đó kịp flush (React Strict Mode dev cố
  // tình double-invoke effect để bắt lỗi này, hoặc 2 lần setItems dồn dập bất kỳ lý do gì), item vẫn
  // còn "queued" trong closure cũ nên bị dispatch (gọi initMultipartUpload/presign-upload) 2 LẦN —
  // lỗi thật đã gặp: multipart init 2 lần trùng nhau tạo 2 uploadId, complete() sau đó luôn thất bại.
  const dispatchedIdsRef = useRef<Set<string>>(new Set());

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

  const updatePart = useCallback(
    (itemId: string, partNumber: number, patch: Partial<PartState>) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId || !it.parts) return it;
          const parts = it.parts.map((p) => (p.partNumber === partNumber ? { ...p, ...patch } : p));
          const uploadedTotal = parts.reduce(
            (sum, p) => sum + (p.status === "success" ? p.end - p.start : p.uploadedBytes),
            0,
          );
          // Giữ dưới 100 tới khi complete hẳn — 100% "ảo" trong lúc còn chờ ráp file dễ gây hiểu lầm đã xong.
          const progress =
            it.file.size > 0 ? Math.min(99, Math.round((uploadedTotal / it.file.size) * 100)) : 99;
          return { ...it, parts, progress };
        }),
      );
    },
    [],
  );

  // Đường PUT đơn (file <= 5GB) — không đổi so với bản trước: xin presigned URL rồi PUT thẳng bằng
  // XMLHttpRequest thô (progress event mà fetch() không có), backend không giữ request nào mở suốt
  // lúc tải nên không sợ timeout.
  const runSingleUpload = useCallback(
    (item: UploadItem) => {
      updateItem(item.id, { status: "signing", error: null });
      apiFetch<{ url: string; key: string }>(
        `/storage-providers/${item.providerId}/files/presign-upload`,
        {
          method: "POST",
          body: JSON.stringify({ filename: item.file.name, folder: item.folder || undefined }),
        },
      )
        .then(({ url, key }) => {
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
            updateItem(item.id, {
              status: "error",
              error:
                "Lỗi mạng lúc tải lên. Nếu lặp lại, kiểm tra cấu hình CORS của bucket (xem hướng dẫn phía trên) hoặc mở DevTools > Console để xem lý do chặn thật.",
            });
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

  // PUT 1 phần multipart: xin presigned URL riêng cho đúng partNumber này (ký ngay trước khi tải,
  // không phụ thuộc hạn của các phần khác), rồi PUT bằng XHR để lấy progress + đọc ETag từ response
  // header (bucket PHẢI bật CORS ExposeHeaders: ["ETag"] thì trình duyệt mới đọc được header này —
  // thiếu cấu hình đó sẽ báo lỗi rõ ràng thay vì âm thầm gửi ETag rỗng lên completeMultipartUpload).
  // Trả kết quả {partNumber, eTag} thẳng qua Promise thay vì buộc bên gọi đọc lại từ React state —
  // lỗi thật đã gặp: đọc lại "parts" từ itemsRef ngay sau khi Promise.all() resolve bị stale (setState
  // của lần cập nhật "success" cuối cùng chưa kịp flush/re-render), rớt mất phần vừa upload xong
  // khỏi danh sách gửi lên completeMultipartUpload dù chính phần đó đã PUT thành công lên bucket.
  const uploadPart = useCallback(
    (item: UploadItem, part: PartState): Promise<{ partNumber: number; eTag: string }> => {
      return apiFetch<{ url: string }>(
        `/storage-providers/${item.providerId}/files/presign-upload/multipart/part`,
        {
          method: "POST",
          body: JSON.stringify({ key: item.key, uploadId: item.uploadId, partNumber: part.partNumber }),
        },
      ).then(
        ({ url }) =>
          new Promise<{ partNumber: number; eTag: string }>((resolve, reject) => {
            const current = itemsRef.current.find((it) => it.id === item.id);
            if (!current || current.status === "cancelled") {
              reject(new Error("cancelled"));
              return;
            }

            const blob = item.file.slice(part.start, part.end);
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", url);
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                updatePart(item.id, part.partNumber, { uploadedBytes: e.loaded });
              }
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                const eTag = xhr.getResponseHeader("ETag");
                if (!eTag) {
                  reject(
                    new Error(
                      `Không đọc được ETag của phần ${part.partNumber} — bucket cần thêm "ETag" vào CORS ExposeHeaders.`,
                    ),
                  );
                  return;
                }
                updatePart(item.id, part.partNumber, {
                  status: "success",
                  eTag,
                  uploadedBytes: blob.size,
                  xhr: null,
                });
                resolve({ partNumber: part.partNumber, eTag });
              } else {
                reject(new Error(`Phần ${part.partNumber} bị từ chối (HTTP ${xhr.status}).`));
              }
            };
            xhr.onerror = () =>
              reject(
                new Error(
                  `Lỗi mạng lúc tải phần ${part.partNumber}. Nếu lặp lại ở mọi phần, kiểm tra CORS bucket (xem hướng dẫn phía trên) hoặc mở DevTools > Console.`,
                ),
              );
            xhr.onabort = () => reject(new Error("cancelled"));
            updatePart(item.id, part.partNumber, { status: "uploading", xhr });
            xhr.send(blob);
          }),
      );
    },
    [updatePart],
  );

  // Chạy tối đa PART_CONCURRENCY phần song song trong 1 file — chỉ tải lại phần CHƯA xong, nên bấm
  // Thử lại sau khi lỗi giữa chừng sẽ tiếp tục từ chỗ dở dang thay vì tải lại từ đầu. Trả về TOÀN BỘ
  // danh sách phần đã xong (gộp phần vừa tải + phần đã xong từ trước, nếu là resume) trực tiếp từ
  // biến cục bộ — không đọc lại React state, tránh race điều kiện đã ghi ở uploadPart.
  const runPartsPool = useCallback(
    async (
      item: UploadItem,
      parts: PartState[],
    ): Promise<{ partNumber: number; eTag: string }[]> => {
      const alreadyDone = parts
        .filter((p) => p.status === "success" && p.eTag)
        .map((p) => ({ partNumber: p.partNumber, eTag: p.eTag! }));
      const pending = parts.filter((p) => p.status !== "success");
      const newlyDone: { partNumber: number; eTag: string }[] = [];
      let index = 0;
      let firstError: Error | null = null;

      async function worker() {
        while (index < pending.length) {
          const current = itemsRef.current.find((it) => it.id === item.id);
          if (!current || current.status === "cancelled") return;
          const part = pending[index];
          index += 1;
          try {
            const result = await uploadPart(item, part);
            newlyDone.push(result);
          } catch (err) {
            firstError ??= err instanceof Error ? err : new Error("Lỗi không rõ khi tải phần");
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(PART_CONCURRENCY, pending.length) }, () => worker()),
      );
      if (firstError) throw firstError;
      return [...alreadyDone, ...newlyDone];
    },
    [uploadPart],
  );

  // Đường multipart (file > 5GB): init (hoặc dùng lại uploadId đã có nếu đây là lần thử lại) ->
  // tải song song từng phần -> ráp file bằng complete. Giữ nguyên key/uploadId/parts trong state
  // xuyên suốt các lần thử lại để không phải tải lại phần đã xong.
  const runMultipartUpload = useCallback(
    async (item: UploadItem) => {
      try {
        let key = item.key;
        let uploadId = item.uploadId;
        let parts = item.parts;

        if (!key || !uploadId || !parts) {
          updateItem(item.id, { status: "signing", error: null });
          const init = await apiFetch<{ key: string; uploadId: string }>(
            `/storage-providers/${item.providerId}/files/presign-upload/multipart/init`,
            {
              method: "POST",
              body: JSON.stringify({
                filename: item.file.name,
                folder: item.folder || undefined,
                contentType: item.file.type || undefined,
              }),
            },
          );
          key = init.key;
          uploadId = init.uploadId;
          parts = buildParts(item.file);
          updateItem(item.id, { key, uploadId, parts, status: "uploading" });
        } else {
          updateItem(item.id, { status: "uploading", error: null });
        }

        const current = itemsRef.current.find((it) => it.id === item.id);
        if (!current || current.status === "cancelled") return;

        const finishedParts = await runPartsPool({ ...item, key, uploadId }, parts);

        const afterParts = itemsRef.current.find((it) => it.id === item.id);
        if (!afterParts || afterParts.status === "cancelled") return;

        updateItem(item.id, { status: "completing" });
        await apiFetch(
          `/storage-providers/${item.providerId}/files/presign-upload/multipart/complete`,
          {
            method: "POST",
            body: JSON.stringify({
              key,
              uploadId,
              parts: finishedParts.map((p) => ({ partNumber: p.partNumber, eTag: p.eTag })),
            }),
          },
        );
        updateItem(item.id, { status: "success", progress: 100 });
      } catch (err) {
        if (err instanceof Error && err.message === "cancelled") return;
        updateItem(item.id, {
          status: "error",
          error: err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Lỗi tải file lớn",
        });
      }
    },
    [runPartsPool, updateItem],
  );

  // Hàng đợi giới hạn số FILE tải song song (MAX_CONCURRENT) — kéo thả 20 file cùng lúc không dí
  // băng thông trình duyệt vào 1 request khổng lồ hay mở tràn lan kết nối song song. File nhỏ đi
  // đường PUT đơn, file > 5GB tự chuyển sang multipart theo đúng file.size của chính nó.
  useEffect(() => {
    const active = items.filter(
      (it) => it.status === "uploading" || it.status === "signing" || it.status === "completing",
    );
    const queued = items.filter(
      (it) => it.status === "queued" && !dispatchedIdsRef.current.has(it.id),
    );
    const slots = MAX_CONCURRENT - active.length;
    if (slots <= 0 || queued.length === 0) return;
    queued.slice(0, slots).forEach((it) => {
      dispatchedIdsRef.current.add(it.id);
      if (it.file.size > MULTIPART_THRESHOLD_BYTES) runMultipartUpload(it);
      else runSingleUpload(it);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    const next: UploadItem[] = files.map((file) => ({
      id: newId(),
      file,
      providerId,
      folder,
      status: "queued",
      progress: 0,
      key: null,
      error: null,
      xhr: null,
      uploadId: null,
      parts: null,
    }));
    setItems((prev) => [...prev, ...next]);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  function handleCancel(item: UploadItem) {
    if (item.status === "queued" || item.status === "signing" || item.status === "completing") {
      updateItem(item.id, { status: "cancelled" });
      return;
    }
    if (item.parts) {
      item.parts.forEach((p) => p.xhr?.abort());
      updateItem(item.id, { status: "cancelled" });
      if (item.key && item.uploadId) {
        apiFetch(`/storage-providers/${item.providerId}/files/presign-upload/multipart/abort`, {
          method: "POST",
          body: JSON.stringify({ key: item.key, uploadId: item.uploadId }),
        }).catch(() => {});
      }
      return;
    }
    if (item.status === "uploading" && item.xhr) {
      item.xhr.abort();
    }
  }

  function handleRetry(item: UploadItem) {
    // Không xoá key/uploadId/parts — multipart resume từ phần dở dang, PUT đơn tự xin URL mới.
    dispatchedIdsRef.current.delete(item.id);
    updateItem(item.id, { status: "queued", error: null, xhr: null });
  }

  function handleRemove(id: string) {
    dispatchedIdsRef.current.delete(id);
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
  const activeCount = items.filter(
    (it) => it.status === "uploading" || it.status === "signing" || it.status === "completing",
  ).length;

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
        trung gian nên không sợ timeout với file nặng. File trên {formatFileSize(MULTIPART_THRESHOLD_BYTES)}{" "}
        tự động chia phần (multipart) để tải song song, không giới hạn dung lượng.
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
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]`}
          </pre>
          <p>
            Thay đúng domain frontend production đang dùng vào <code>AllowedOrigins</code>. Nếu vẫn lỗi sau khi
            cấu hình CORS, mở DevTools (F12) → tab Console/Network lúc upload để xem lý do chặn thật (chữ ký
            SigV4 sai, DNS/endpoint sai...).
          </p>
        </div>
      </details>

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
        </>
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
