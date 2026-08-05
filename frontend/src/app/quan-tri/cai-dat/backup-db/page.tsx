"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { formatFileSize } from "@/lib/format";
import type { BackupConfig, DbBackupRecord, StorageProvider } from "@/lib/types";
import { ErrorBanner, SuccessBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]";

const STATUS_LABEL = { SUCCESS: "Thành công", FAILED: "Thất bại" } as const;
const STATUS_COLOR = {
  SUCCESS: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
} as const;

export default function AdminBackupDbPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [providers, setProviders] = useState<StorageProvider[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(3);
  const [minute, setMinute] = useState(0);
  const [retentionCount, setRetentionCount] = useState(7);
  const [storageProviderId, setStorageProviderId] = useState("");

  const [records, setRecords] = useState<DbBackupRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const reloadConfig = useCallback(() => {
    apiFetch<BackupConfig>("/db-backup/config")
      .then((res) => {
        setEnabled(res.enabled);
        setHour(res.hour);
        setMinute(res.minute);
        setRetentionCount(res.retentionCount);
        setStorageProviderId(res.storageProviderId ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, []);

  const reloadRecords = useCallback(() => {
    apiFetch<{ items: DbBackupRecord[]; total: number }>(
      `/db-backup/records?page=${page}&limit=${PAGE_SIZE}`,
    )
      .then((res) => {
        setRecords(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [page]);

  useEffect(() => {
    if (!user) return;
    apiFetch<StorageProvider[]>("/storage-providers")
      .then((all) => setProviders(all.filter((p) => p.type !== "MAILJET")))
      .catch(() => setProviders([]));
    reloadConfig();
  }, [user, reloadConfig]);

  useEffect(() => {
    if (!user) return;
    reloadRecords();
  }, [user, reloadRecords]);

  async function handleSaveConfig() {
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await apiFetch<BackupConfig>("/db-backup/config", {
        method: "PUT",
        body: JSON.stringify({
          enabled,
          hour,
          minute,
          retentionCount,
          storageProviderId: storageProviderId || null,
        }),
      });
      setMessage("Đã lưu cấu hình Backup DB.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  async function handleRunNow() {
    setError(null);
    setMessage(null);
    setRunning(true);
    try {
      const record = await apiFetch<DbBackupRecord>("/db-backup/run-now", { method: "POST" });
      if (record.status === "SUCCESS") {
        setMessage(`Backup thành công — ${formatFileSize(record.sizeBytes)}.`);
      } else {
        setError(record.errorMessage || "Backup thất bại.");
      }
      setPage(1);
      reloadRecords();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setRunning(false);
    }
  }

  async function handleDownload(record: DbBackupRecord) {
    setError(null);
    try {
      const res = await apiFetch<{ url: string }>(`/db-backup/records/${record.id}/download-url`);
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.SETTINGS_BACKUP)) {
    return <ForbiddenPage />;
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4 px-8 py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Backup DB</h1>
      <p className="text-sm text-zinc-500">
        Backup toàn bộ database (pg_dump, nén gzip) lên Storage Provider đã chọn, tự động chạy mỗi
        ngày vào giờ cấu hình — hoặc bấm &quot;Backup ngay&quot; để chạy thủ công.
      </p>

      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cấu hình</p>
          <label className="flex items-center gap-2 text-xs text-zinc-600">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Bật backup tự động hàng ngày
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Storage Provider lưu file backup
          <select
            value={storageProviderId}
            onChange={(e) => setStorageProviderId(e.target.value)}
            className={inputClass}
          >
            <option value="">— Chọn provider —</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({p.type})
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Giờ (0-23)
            <input
              type="number"
              min={0}
              max={23}
              value={hour}
              onChange={(e) => setHour(Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Phút (0-59)
            <input
              type="number"
              min={0}
              max={59}
              value={minute}
              onChange={(e) => setMinute(Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Số bản giữ lại
            <input
              type="number"
              min={1}
              max={90}
              value={retentionCount}
              onChange={(e) => setRetentionCount(Math.max(1, Number(e.target.value) || 1))}
              className={inputClass}
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={saving}
            className="w-fit rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu cấu hình"}
          </button>
          <button
            type="button"
            onClick={handleRunNow}
            disabled={running || !storageProviderId}
            className="w-fit rounded-md border border-[#1d3557] px-4 py-2 text-sm font-medium text-[#1d3557] hover:bg-[#1d3557]/5 disabled:opacity-50"
          >
            {running ? "Đang backup..." : "Backup ngay"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Lịch sử backup</p>
        {records.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
            Chưa có bản backup nào.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {records.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLOR[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                  <span>{new Date(r.createdAt).toLocaleString("vi-VN")}</span>
                  {r.sizeBytes !== null && <span>· {formatFileSize(r.sizeBytes)}</span>}
                  {r.errorMessage && (
                    <span className="text-red-600" title={r.errorMessage}>
                      · {r.errorMessage.slice(0, 60)}
                    </span>
                  )}
                </div>
                {r.status === "SUCCESS" && (
                  <button
                    type="button"
                    onClick={() => handleDownload(r)}
                    className="rounded px-2 py-0.5 text-xs font-medium text-[#1d3557] hover:bg-zinc-100"
                  >
                    Tải xuống
                  </button>
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
    </div>
  );
}
