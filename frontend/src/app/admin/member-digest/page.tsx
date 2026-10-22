"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type {
  MemberDigestBatch,
  MemberDigestConfig,
  MemberDigestEligibleCount,
  MemberDigestRecipient,
  MemberDigestRunResult,
  PaginatedResult,
} from "@/lib/types";
import { ErrorBanner, SuccessBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]";

const DAY_LABEL = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

const PLACEHOLDERS = [
  "displayName",
  "accountUrl",
  "newPostsHtml",
  "mostViewedHtml",
  "mostDownloadedHtml",
  "timestamp",
];

const BATCH_STATUS_LABEL: Record<MemberDigestBatch["status"], string> = {
  PENDING: "Chờ xử lý",
  RUNNING: "Đang gửi",
  COMPLETED: "Hoàn tất",
};

const RECIPIENT_STATUS_LABEL: Record<MemberDigestRecipient["status"], string> = {
  PENDING: "Chờ gửi",
  SENT: "Đã gửi",
  FAILED: "Thất bại",
};

export default function AdminMemberDigestPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [enabled, setEnabled] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [eligible, setEligible] = useState<number | null>(null);
  const [batches, setBatches] = useState<MemberDigestBatch[]>([]);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<MemberDigestRecipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const reload = useCallback(() => {
    apiFetch<MemberDigestConfig>("/member-digest/config")
      .then((res) => {
        setEnabled(res.enabled);
        setDayOfWeek(res.dayOfWeek);
        setHour(res.hour);
        setMinute(res.minute);
        setLastSentAt(res.lastSentAt);
        setSubject(res.template.subject);
        setHtml(res.template.html);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
    apiFetch<MemberDigestEligibleCount>("/member-digest/eligible-count")
      .then((res) => setEligible(res.eligible))
      .catch(() => setEligible(null));
    apiFetch<PaginatedResult<MemberDigestBatch>>("/member-digest/batches?limit=20")
      .then((res) => setBatches(res.items))
      .catch(() => setBatches([]));
  }, []);

  useEffect(() => {
    if (!user) return;
    reload();
  }, [user, reload]);

  async function handleSave() {
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await apiFetch<MemberDigestConfig>("/member-digest/config", {
        method: "PUT",
        body: JSON.stringify({
          enabled,
          dayOfWeek,
          hour,
          minute,
          template: { subject, html },
        }),
      });
      setMessage("Đã lưu cấu hình bản tin thành viên.");
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
      const res = await apiFetch<MemberDigestRunResult>("/member-digest/run-now", {
        method: "POST",
      });
      setMessage(
        res.skippedReason
          ? `Không gửi: ${res.skippedReason}`
          : `Đã tạo batch ${res.totalRecipients} người nhận — sẽ gửi dần trong vài phút, xem nhật ký bên dưới.`,
      );
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setRunning(false);
    }
  }

  async function handleTestSend() {
    setError(null);
    setMessage(null);
    setTesting(true);
    try {
      const res = await apiFetch<{ success: boolean; message: string }>("/member-digest/test", {
        method: "POST",
      });
      if (res.success) setMessage(res.message);
      else setError(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setTesting(false);
    }
  }

  async function toggleBatch(batchId: string) {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null);
      return;
    }
    setExpandedBatchId(batchId);
    setLoadingRecipients(true);
    try {
      const res = await apiFetch<PaginatedResult<MemberDigestRecipient>>(
        `/member-digest/batches/${batchId}/recipients?limit=100`,
      );
      setRecipients(res.items);
    } catch {
      setRecipients([]);
    } finally {
      setLoadingRecipients(false);
    }
  }

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.MEMBER_DIGEST_MANAGE)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Email thành viên (Bản tin định kỳ)</h1>
      <p className="text-sm text-zinc-500">
        Gửi tự động bài viết mới / được xem nhiều / được tải nhiều cho thành viên đã kích hoạt tài
        khoản (khác Newsletter — email ẩn danh đăng ký ở footer). Thành viên tự tắt nhận ở trang Tài
        khoản của họ. Hàng đợi xử lý theo lô mỗi phút để không dí quá nhiều email cùng lúc.
      </p>

      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      {eligible !== null && (
        <div className="rounded-md border border-zinc-200 p-4 text-sm text-zinc-700">
          <span className="font-semibold">{eligible}</span> thành viên đủ điều kiện nhận (đã kích
          hoạt + chưa tắt nhận)
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Bật gửi tự động hàng tuần
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Ngày trong tuần
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className={inputClass}
            >
              {DAY_LABEL.map((label, index) => (
                <option key={index} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
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
        </div>

        {lastSentAt && (
          <p className="text-xs text-zinc-400">
            Lần tạo batch gần nhất: {new Date(lastSentAt).toLocaleString("vi-VN")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <p className="text-xs text-zinc-400">
          Biến dùng được: {PLACEHOLDERS.map((p) => `{{${p}}}`).join(", ")}. 3 biến{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5">...Html</code> tự động rỗng nếu nhóm đó
          không có bài viết nào.
        </p>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Tiêu đề
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Nội dung (HTML)
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            rows={10}
            className={`${inputClass} font-mono text-xs`}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-fit rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu cấu hình"}
        </button>
        <button
          type="button"
          onClick={handleRunNow}
          disabled={running}
          className="w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {running ? "Đang tạo batch..." : "Gửi ngay"}
        </button>
        <button
          type="button"
          onClick={handleTestSend}
          disabled={testing}
          className="w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {testing ? "Đang gửi..." : "Gửi thử tới email của tôi"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">Nhật ký gửi (20 batch gần nhất)</h2>
        {batches.length === 0 ? (
          <p className="text-sm text-zinc-400">Chưa có batch nào.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Thời gian</th>
                  <th className="px-3 py-2">Nguồn</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2 text-right">Tổng</th>
                  <th className="px-3 py-2 text-right">Đã gửi</th>
                  <th className="px-3 py-2 text-right">Lỗi</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <Fragment key={batch.id}>
                    <tr
                      onClick={() => toggleBatch(batch.id)}
                      className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50"
                    >
                      <td className="px-3 py-2">{new Date(batch.startedAt).toLocaleString("vi-VN")}</td>
                      <td className="px-3 py-2">{batch.trigger === "CRON" ? "Tự động" : "Thủ công"}</td>
                      <td className="px-3 py-2">{BATCH_STATUS_LABEL[batch.status]}</td>
                      <td className="px-3 py-2 text-right">{batch.totalRecipients}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{batch.sentCount}</td>
                      <td className="px-3 py-2 text-right text-red-600">{batch.failedCount}</td>
                    </tr>
                    {expandedBatchId === batch.id && (
                      <tr className="border-t border-zinc-100 bg-zinc-50">
                        <td colSpan={6} className="px-3 py-3">
                          {loadingRecipients ? (
                            <p className="text-xs text-zinc-400">Đang tải...</p>
                          ) : recipients.length === 0 ? (
                            <p className="text-xs text-zinc-400">Chưa có recipient nào.</p>
                          ) : (
                            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                              {recipients.map((r) => (
                                <div
                                  key={r.id}
                                  className="flex items-center justify-between gap-2 text-xs"
                                >
                                  <span className="text-zinc-700">{r.email}</span>
                                  <span
                                    className={
                                      r.status === "SENT"
                                        ? "text-emerald-600"
                                        : r.status === "FAILED"
                                          ? "text-red-600"
                                          : "text-zinc-400"
                                    }
                                  >
                                    {RECIPIENT_STATUS_LABEL[r.status]}
                                    {r.errorMessage ? ` — ${r.errorMessage}` : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
