"use client";

// Hàng đợi upload sống ở đây (mount 1 lần trong layout /admin, xem admin/layout.tsx) thay vì
// bên trong trang upload — điều hướng SPA sang trang admin khác rồi quay lại vẫn giữ nguyên tiến độ
// (không sống qua reload toàn trang, JS không giữ được đối tượng File qua lần tải lại — nằm ngoài
// phạm vi hợp lý để giải quyết). Toàn bộ state/logic dưới đây chuyển nguyên trạng từ
// upload/page.tsx cũ, chỉ thêm phần ghi lịch sử (POST /cloud-files/upload-history) tại các điểm
// item đạt trạng thái cuối.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import type { StorageProvider } from "@/lib/types";

export type UploadStatus =
  | "queued"
  | "signing"
  | "uploading"
  | "completing"
  | "success"
  | "error"
  | "cancelled";

export interface PartState {
  partNumber: number;
  start: number;
  end: number;
  status: "pending" | "uploading" | "success" | "error";
  uploadedBytes: number;
  eTag: string | null;
  xhr: XMLHttpRequest | null;
}

export interface UploadItem {
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
export const MULTIPART_THRESHOLD_BYTES = 5 * 1024 * 1024 * 1024;
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

const HISTORY_STATUS: Record<"success" | "error" | "cancelled", "SUCCESS" | "FAILED" | "CANCELLED"> = {
  success: "SUCCESS",
  error: "FAILED",
  cancelled: "CANCELLED",
};

interface UploadQueueContextValue {
  providers: StorageProvider[];
  providerId: string;
  setProviderId: (id: string) => void;
  folder: string;
  setFolder: (folder: string) => void;
  items: UploadItem[];
  loadError: string | null;
  historyVersion: number;
  addFiles: (files: FileList | File[]) => void;
  handleCancel: (item: UploadItem) => void;
  handleRetry: (item: UploadItem) => void;
  handleRemove: (id: string) => void;
  clearFinished: () => void;
}

const UploadQueueContext = createContext<UploadQueueContextValue | null>(null);

export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [providers, setProviders] = useState<StorageProvider[]>([]);
  const [providerId, setProviderId] = useState("");
  const [folder, setFolder] = useState("");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
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
  // Item đạt trạng thái cuối (success/error/cancelled) chỉ ghi lịch sử ĐÚNG 1 LẦN — tránh ghi lặp khi
  // effect quét items chạy lại (mọi lần setItems khác đều trigger effect này, không chỉ lần đổi status).
  const historyLoggedIdsRef = useRef<Set<string>>(new Set());

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

  // Đường PUT đơn (file <= 5GB) — xin presigned URL rồi PUT thẳng bằng XMLHttpRequest thô (progress
  // event mà fetch() không có), backend không giữ request nào mở suốt lúc tải nên không sợ timeout.
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

  // Ghi lịch sử upload (bảng cloud_upload_records, xem cloud-upload-history.controller.ts) ngay khi
  // 1 item đạt trạng thái cuối — fire-and-forget, lỗi ghi log không ảnh hưởng luồng upload chính.
  useEffect(() => {
    const terminal = items.filter(
      (it) =>
        (it.status === "success" || it.status === "error" || it.status === "cancelled") &&
        !historyLoggedIdsRef.current.has(it.id),
    );
    if (terminal.length === 0) return;
    terminal.forEach((it) => {
      historyLoggedIdsRef.current.add(it.id);
      const status = HISTORY_STATUS[it.status as "success" | "error" | "cancelled"];
      apiFetch("/cloud-files/upload-history", {
        method: "POST",
        body: JSON.stringify({
          fileName: it.file.name,
          objectKey: it.key,
          folder: it.folder || undefined,
          sizeBytes: it.file.size,
          status,
          errorMessage: it.error ?? undefined,
          storageProviderId: it.providerId,
        }),
      })
        .then(() => setHistoryVersion((v) => v + 1))
        .catch(() => {});
    });
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
    historyLoggedIdsRef.current.delete(item.id);
    updateItem(item.id, { status: "queued", error: null, xhr: null });
  }

  function handleRemove(id: string) {
    dispatchedIdsRef.current.delete(id);
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function clearFinished() {
    setItems((prev) => prev.filter((it) => it.status !== "success"));
  }

  return (
    <UploadQueueContext.Provider
      value={{
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
      }}
    >
      {children}
    </UploadQueueContext.Provider>
  );
}

export function useUploadQueue() {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) throw new Error("useUploadQueue phải dùng trong <UploadQueueProvider>");
  return ctx;
}
