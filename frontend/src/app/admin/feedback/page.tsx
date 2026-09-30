"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { Feedback, FeedbackStatus } from "@/lib/types";
import { ErrorBanner, FormField, SubmitButton, SuccessBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  PENDING: "Chờ xử lý",
  RESOLVED: "Đã xử lý",
};

// Email nhận phản hồi — email tài khoản nếu góp ý gửi lúc đã đăng nhập, không thì email khách để lại.
function contactEmail(f: Feedback): string | null {
  return f.author?.email ?? f.email;
}

const STATUS_COLOR: Record<FeedbackStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
};

export default function AdminFeedbackPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Feedback[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "">("PENDING");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Góp ý đang mở khung soạn phản hồi (chỉ 1 cái tại 1 thời điểm) + nội dung đang soạn.
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const reload = useCallback(() => {
    const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (statusFilter) query.set("status", statusFilter);
    if (q) query.set("q", q);
    apiFetch<{ items: Feedback[]; total: number }>(`/feedback?${query.toString()}`)
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

  async function resolve(feedback: Feedback) {
    setError(null);
    setMessage(null);
    setBusyId(feedback.id);
    try {
      await apiFetch(`/feedback/${feedback.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "RESOLVED" }),
      });
      setMessage("Đã đánh dấu xử lý xong.");
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusyId(null);
    }
  }

  // Gửi email phản hồi (template "Khi Admin phản hồi góp ý" ở Cài đặt Email) + đánh dấu đã xử lý.
  async function sendReply(feedback: Feedback) {
    if (!replyText.trim()) return;
    setError(null);
    setMessage(null);
    setBusyId(feedback.id);
    try {
      await apiFetch(`/feedback/${feedback.id}/reply`, {
        method: "PATCH",
        body: JSON.stringify({ message: replyText.trim() }),
      });
      setMessage(`Đã gửi phản hồi tới ${contactEmail(feedback)}.`);
      setReplyingId(null);
      setReplyText("");
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
  if (!user.permissionKeys?.includes(PERMISSIONS.FEEDBACK_MANAGE)) {
    return <ForbiddenPage />;
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Góp ý người dùng</h1>
      <p className="text-sm text-zinc-500">
        Góp ý gửi từ nút Feedback trên toàn site. Khách chưa đăng nhập bắt buộc để lại email (góp ý
        cũ trước đó có thể không có) — phản hồi gửi qua email theo template ở Cài đặt Email.
      </p>

      <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
          Trạng thái
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as FeedbackStatus | "");
            }}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="PENDING">Chờ xử lý</option>
            <option value="RESOLVED">Đã xử lý</option>
          </select>
        </label>
        <FormField
          label="Tìm theo nội dung / tên / email"
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
          Không có góp ý nào.
        </p>
      )}

      {items && items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((f) => (
            <div key={f.id} className="flex flex-col gap-1.5 rounded-md border border-zinc-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="font-medium text-zinc-800">
                  {f.author?.displayName ?? f.name ?? "Ẩn danh"}
                </span>
                <span>({contactEmail(f) ?? "không có email"})</span>
                <span>·</span>
                <span>{new Date(f.createdAt).toLocaleString("vi-VN")}</span>
                <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLOR[f.status]}`}>
                  {STATUS_LABEL[f.status]}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-zinc-800">{f.message}</p>
              {f.status === "PENDING" && replyingId !== f.id && (
                <div className="flex items-center gap-1">
                  {contactEmail(f) && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingId(f.id);
                        setReplyText("");
                      }}
                      className="rounded px-2 py-0.5 text-xs font-medium text-[#1d3557] hover:bg-zinc-100"
                    >
                      Phản hồi qua email
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => resolve(f)}
                    disabled={busyId === f.id}
                    className="rounded px-2 py-0.5 text-xs font-medium text-emerald-600 hover:bg-zinc-100 disabled:opacity-50"
                  >
                    Đánh dấu đã xử lý
                  </button>
                </div>
              )}
              {replyingId === f.id && (
                <div className="flex flex-col gap-2 rounded-md border border-[#1d3557]/30 bg-[#1d3557]/5 p-2">
                  <label className="flex flex-col gap-1 text-xs text-zinc-600">
                    Phản hồi gửi tới {contactEmail(f)} — đánh dấu đã xử lý sau khi gửi thành công
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={4}
                      maxLength={5000}
                      autoFocus
                      placeholder="Nhập nội dung phản hồi..."
                      className="resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => sendReply(f)}
                      disabled={busyId === f.id || !replyText.trim()}
                      className="rounded-md bg-[#1d3557] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
                    >
                      {busyId === f.id ? "Đang gửi..." : "Gửi phản hồi"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyingId(null)}
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
                    >
                      Huỷ
                    </button>
                  </div>
                </div>
              )}
              {f.status === "RESOLVED" && f.replyMessage && (
                <div className="rounded-md border-l-4 border-[#1d3557] bg-zinc-50 px-3 py-2">
                  <p className="text-xs font-medium text-zinc-500">Phản hồi đã gửi</p>
                  <p className="whitespace-pre-wrap text-sm text-zinc-800">{f.replyMessage}</p>
                </div>
              )}
              {f.status === "RESOLVED" && f.resolvedBy && (
                <p className="text-xs text-zinc-400">
                  {f.replyMessage ? "Đã phản hồi" : "Đã xử lý"} bởi {f.resolvedBy.displayName}
                  {f.resolvedAt && ` lúc ${new Date(f.resolvedAt).toLocaleString("vi-VN")}`}
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
