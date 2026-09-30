"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { AuditAction, AuditLogEntry } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

const PAGE_SIZE = 20;

const ACTION_LABEL: Record<AuditAction, string> = {
  ROLE_ASSIGNED: "Gán vai trò",
  ROLE_REMOVED: "Gỡ vai trò",
  WALLET_ADJUSTED: "Điều chỉnh ví tay",
  STORAGE_PROVIDER_KEY_CHANGED: "Đổi key R2/S3",
  DOWNLOAD_BYPASSED: "Admin lấy link tải (bỏ qua $P)",
  SUBSCRIPTION_REVOKED: "Thu hồi Subscription",
  INTL_TOPUP_APPROVED: "Duyệt nạp quốc tế",
  INTL_TOPUP_REJECTED: "Từ chối nạp quốc tế",
  ADMIN_ACTION: "Thao tác quản trị",
};

// ADMIN_ACTION (ghi tự động mọi thao tác quản trị) mang mô tả cụ thể trong metadata.label — vd "Sửa
// bài viết", "Lưu cài đặt SePay"; các loại còn lại dùng nhãn cố định ở ACTION_LABEL.
function actionText(log: AuditLogEntry): string {
  const label = log.metadata?.label;
  return log.action === "ADMIN_ACTION" && typeof label === "string" ? label : ACTION_LABEL[log.action];
}

// Chi tiết đầy đủ (bấm để mở) — bỏ các trường đã hiện ở cột khác (label/handler) cho gọn.
function detailJson(log: AuditLogEntry): string | null {
  if (!log.metadata) return null;
  const rest = Object.fromEntries(
    Object.entries(log.metadata).filter(([key]) => key !== "label" && key !== "handler"),
  );
  return JSON.stringify(rest, null, 2);
}

export default function AuditLogPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AuditLogEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<AuditAction | "">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const reload = useCallback(() => {
    const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (actionFilter) query.set("action", actionFilter);
    apiFetch<{ items: AuditLogEntry[]; total: number }>(`/audit-log?${query.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [page, actionFilter]);

  useEffect(() => {
    if (!user) return;
    reload();
  }, [user, reload]);

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.AUDIT_VIEW)) {
    return <ForbiddenPage />;
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Nhật ký hệ thống (Audit log)</h1>
      <p className="text-sm text-zinc-500">
        Lịch sử mọi thao tác quản trị (tạo/sửa/xoá nội dung, cài đặt, user, giao dịch...) — hệ thống tự
        ghi lại, dữ liệu nhạy cảm (mật khẩu, secret, token, API key) được ẩn.
      </p>

      <label className="flex w-fit flex-col gap-1.5 text-sm text-zinc-700">
        Loại thao tác
        <select
          value={actionFilter}
          onChange={(e) => {
            setPage(1);
            setActionFilter(e.target.value as AuditAction | "");
          }}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        >
          <option value="">Tất cả</option>
          {(Object.keys(ACTION_LABEL) as AuditAction[]).map((key) => (
            <option key={key} value={key}>
              {ACTION_LABEL[key]}
            </option>
          ))}
        </select>
      </label>

      <ErrorBanner message={error} />

      {items && items.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Chưa có log nào.
        </p>
      )}

      {items && items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Thời gian</th>
                <th className="px-3 py-2">Người thực hiện</th>
                <th className="px-3 py-2">Thao tác</th>
                <th className="px-3 py-2">Đối tượng</th>
                <th className="px-3 py-2">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {items.map((log) => (
                <tr key={log.id} className="border-t border-zinc-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                    {new Date(log.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-3 py-2 text-zinc-800">
                    {log.actor.displayName}
                    <span className="block text-xs text-zinc-400">{log.actor.email}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        log.action === "ADMIN_ACTION" ? "bg-sky-50 text-sky-700" : "bg-zinc-100 font-mono text-zinc-600"
                      }`}
                    >
                      {actionText(log)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
                    {log.targetType ? `${log.targetType}${log.targetId ? `:${log.targetId}` : ""}` : "—"}
                  </td>
                  <td className="max-w-md px-3 py-2 font-mono text-xs text-zinc-500">
                    {detailJson(log) ? (
                      <details>
                        <summary className="cursor-pointer truncate">
                          {JSON.stringify(log.metadata)}
                        </summary>
                        <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-zinc-50 p-2">
                          {detailJson(log)}
                        </pre>
                        {log.ipAddress && <p className="mt-1 text-zinc-400">IP: {log.ipAddress}</p>}
                      </details>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
