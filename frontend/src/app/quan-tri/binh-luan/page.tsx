"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import type { AdminComment, CommentStatus } from "@/lib/types";
import { ErrorBanner, SuccessBanner } from "@/components/ui";

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<CommentStatus, string> = {
  PUBLISHED: "Đã duyệt",
  PENDING: "Chờ duyệt",
  HIDDEN: "Đã ẩn",
};

const STATUS_COLOR: Record<CommentStatus, string> = {
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-amber-100 text-amber-700",
  HIDDEN: "bg-zinc-200 text-zinc-600",
};

export default function AdminCommentsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AdminComment[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CommentStatus | "">("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const reload = useCallback(() => {
    const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (statusFilter) query.set("status", statusFilter);
    apiFetch<{ items: AdminComment[]; total: number }>(`/comments/moderation/all?${query.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [page, statusFilter]);

  useEffect(() => {
    if (!user) return;
    reload();
  }, [user, reload]);

  async function setStatus(comment: AdminComment, status: CommentStatus) {
    setError(null);
    setMessage(null);
    setBusyId(comment.id);
    try {
      await apiFetch(`/comments/${comment.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusyId(null);
    }
  }

  async function togglePin(comment: AdminComment) {
    setError(null);
    setBusyId(comment.id);
    try {
      await apiFetch(`/comments/${comment.id}/pin`, {
        method: "PATCH",
        body: JSON.stringify({ pinned: !comment.pinned }),
      });
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(comment: AdminComment) {
    if (!confirm("Xoá bình luận này? (kèm tất cả trả lời bên dưới)")) return;
    setError(null);
    setBusyId(comment.id);
    try {
      await apiFetch(`/comments/${comment.id}`, { method: "DELETE" });
      setMessage("Đã xoá bình luận.");
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

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="flex w-full flex-col gap-4 px-8 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Quản lý bình luận</h1>
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value as CommentStatus | "");
          }}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="PUBLISHED">Đã duyệt</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="HIDDEN">Đã ẩn</option>
        </select>
      </div>
      <p className="text-sm text-zinc-500">
        Kiểm duyệt bình luận trên toàn bộ bài viết — duyệt/ẩn, ghim, hoặc xoá.
      </p>

      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      {items && items.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Không có bình luận nào.
        </p>
      )}

      {items && items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((c) => (
            <div key={c.id} className="flex flex-col gap-1.5 rounded-md border border-zinc-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="font-medium text-zinc-800">{c.user.displayName}</span>
                <span>·</span>
                <Link href={`/bai-viet/${c.post.slug}`} target="_blank" className="text-[#1d3557] hover:underline">
                  {c.post.title}
                </Link>
                <span>·</span>
                <span>{new Date(c.createdAt).toLocaleString("vi-VN")}</span>
                <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLOR[c.status]}`}>
                  {STATUS_LABEL[c.status]}
                </span>
                {c.pinned && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700">
                    Đã ghim
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-800">{c.content}</p>
              <div className="flex items-center gap-1">
                {c.status !== "PUBLISHED" && (
                  <button
                    type="button"
                    onClick={() => setStatus(c, "PUBLISHED")}
                    disabled={busyId === c.id}
                    className="rounded px-2 py-0.5 text-xs font-medium text-emerald-600 hover:bg-zinc-100 disabled:opacity-50"
                  >
                    Duyệt
                  </button>
                )}
                {c.status !== "HIDDEN" && (
                  <button
                    type="button"
                    onClick={() => setStatus(c, "HIDDEN")}
                    disabled={busyId === c.id}
                    className="rounded px-2 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
                  >
                    Ẩn
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => togglePin(c)}
                  disabled={busyId === c.id}
                  className="rounded px-2 py-0.5 text-xs font-medium text-[#1d3557] hover:bg-zinc-100 disabled:opacity-50"
                >
                  {c.pinned ? "Bỏ ghim" : "Ghim"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(c)}
                  disabled={busyId === c.id}
                  className="rounded px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-zinc-100 disabled:opacity-50"
                >
                  Xoá
                </button>
              </div>
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
