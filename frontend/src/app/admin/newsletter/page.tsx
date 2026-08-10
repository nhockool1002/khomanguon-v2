"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type {
  NewsletterConfig,
  NewsletterSendResult,
  NewsletterSubscriberCount,
} from "@/lib/types";
import { ErrorBanner, SuccessBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]";

const DAY_LABEL = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export default function AdminNewsletterPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [enabled, setEnabled] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [counts, setCounts] = useState<NewsletterSubscriberCount | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const reload = useCallback(() => {
    apiFetch<NewsletterConfig>("/newsletter/config")
      .then((res) => {
        setEnabled(res.enabled);
        setDayOfWeek(res.dayOfWeek);
        setHour(res.hour);
        setMinute(res.minute);
        setLastSentAt(res.lastSentAt);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
    apiFetch<NewsletterSubscriberCount>("/newsletter/subscriber-count")
      .then(setCounts)
      .catch(() => setCounts(null));
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
      await apiFetch<NewsletterConfig>("/newsletter/config", {
        method: "PUT",
        body: JSON.stringify({ enabled, dayOfWeek, hour, minute }),
      });
      setMessage("Đã lưu cấu hình bản tin.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendNow() {
    setError(null);
    setMessage(null);
    setSending(true);
    try {
      const res = await apiFetch<NewsletterSendResult>("/newsletter/run-now", {
        method: "POST",
      });
      setMessage(
        res.skippedReason
          ? `Không gửi: ${res.skippedReason}`
          : `Đã gửi ${res.sent} email tới subscriber (${res.postCount} bài viết mới).`,
      );
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSending(false);
    }
  }

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.NEWSLETTER_MANAGE)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Bản tin (Newsletter)</h1>
      <p className="text-sm text-zinc-500">
        Gửi tự động danh sách bài viết mới hàng tuần cho người đã đăng ký ở footer trang chủ. Bỏ
        qua tự động nếu không có bài viết mới nào kể từ lần gửi trước.
      </p>

      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      {counts && (
        <div className="rounded-md border border-zinc-200 p-4 text-sm text-zinc-700">
          <span className="font-semibold">{counts.active}</span> người đăng ký đang hoạt động
          {counts.total !== counts.active && (
            <span className="text-zinc-400"> ({counts.total} tổng, kể cả đã huỷ)</span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Bật gửi bản tin tự động hàng tuần
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
            Lần gửi gần nhất: {new Date(lastSentAt).toLocaleString("vi-VN")}
          </p>
        )}

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
            onClick={handleSendNow}
            disabled={sending}
            className="w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {sending ? "Đang gửi..." : "Gửi ngay"}
          </button>
        </div>
      </div>
    </div>
  );
}
