"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { LinkReport, LinkReportStatus } from "@/lib/types";
import { ErrorBanner, FormField, SubmitButton, SuccessBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<LinkReportStatus, string> = {
  PENDING: "Chờ xử lý",
  RESOLVED: "Đã xử lý",
};

const STATUS_COLOR: Record<LinkReportStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
};

export default function AdminLinkReportsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<LinkReport[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<LinkReportStatus | "">("PENDING");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const reload = useCallback(() => {
    const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (statusFilter) query.set("status", statusFilter);
    if (q) query.set("q", q);
    apiFetch<{ items: LinkReport[]; total: number }>(`/link-reports?${query.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [page, statusFilter, q]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQ(qInput.trim());
  }

  useEffect(() => {
    if (!user) return;
    reload();
  }, [user, reload]);

  async function resolve(report: LinkReport) {
    setError(null);
    setMessage(null);
    setBusyId(report.id);
    try {
      await apiFetch(`/link-reports/${report.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "RESOLVED" }),
      });
      setMessage("Đã đánh dấu xử lý xong — email đã gửi cho người báo cáo.");
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)) {
    return <ForbiddenPage />;
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="flex w-full flex-col gap-4 px-8 py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Báo lỗi link tải</h1>
      <p className="text-sm text-zinc-500">
        Hàng chờ xử lý các link tải bị user báo lỗi (link die) — xử lý xong sẽ tự gửi email xác nhận
        cho người đã báo cáo.
      </p>

      <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
          Trạng thái
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as LinkReportStatus | "");
            }}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="PENDING">Chờ xử lý</option>
            <option value="RESOLVED">Đã xử lý</option>
          </select>
        </label>
        <FormField
          label="Tìm theo bài viết / người báo cáo / ghi chú"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Nhập từ khoá..."
        />
        <SubmitButton type="submit">Áp dụng</SubmitButton>
      </form>

      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      {items && items.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Không có báo cáo nào.
        </p>
      )}

      {items && items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((r) => (
            <div key={r.id} className="flex flex-col gap-1.5 rounded-md border border-zinc-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="font-medium text-zinc-800">{r.reporter.displayName}</span>
                <span>({r.reporter.email})</span>
                <span>·</span>
                <Link
                  href={`/bai-viet/${r.downloadLink.post.slug}`}
                  target="_blank"
                  className="text-[#1d3557] hover:underline"
                >
                  {r.downloadLink.post.title}
                </Link>
                <span>·</span>
                <span className="font-mono">{r.downloadLink.objectKey.split("/").pop() || r.downloadLink.label}</span>
                <span>·</span>
                <span>{new Date(r.createdAt).toLocaleString("vi-VN")}</span>
                <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLOR[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
              {r.note && <p className="text-sm text-zinc-800">{r.note}</p>}
              {r.status === "PENDING" && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => resolve(r)}
                    disabled={busyId === r.id}
                    className="rounded px-2 py-0.5 text-xs font-medium text-emerald-600 hover:bg-zinc-100 disabled:opacity-50"
                  >
                    Đánh dấu đã xử lý
                  </button>
                </div>
              )}
              {r.status === "RESOLVED" && r.resolvedBy && (
                <p className="text-xs text-zinc-400">
                  Đã xử lý bởi {r.resolvedBy.displayName}
                  {r.resolvedAt && ` lúc ${new Date(r.resolvedAt).toLocaleString("vi-VN")}`}
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
