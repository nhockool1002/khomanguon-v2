"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { MySubscriptionStatus } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Đếm ngược sống động (tick mỗi giây) — khác formatDaysLeft cũ (chỉ làm tròn ngày, tĩnh). Trả về
// null khi đã hết hạn hẳn để component tự quyết định ẩn card (xem effect refetch bên dưới).
function formatCountdown(endsAt: string): string | null {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  return days > 0 ? `${days} ngày ${clock}` : clock;
}

// Hiển thị trạng thái Subscription (đếm ngược, lượt tải đã dùng/còn lại) — CHỈ hiện khi user đó
// đang có 1 kỳ ACTIVE (không có gì để xem thì không render gì, không hiện placeholder "chưa có
// gói"). Dùng cho CẢ chính chủ lẫn viewer có quyền subscription.view_any xem hồ sơ người khác — mua
// gói giờ chỉ làm ở trang Nạp tiền (subscription-plans.tsx), tab Hồ sơ chỉ đọc.
export function SubscriptionStatusView({ userId }: { userId: string }) {
  const { user: viewer } = useAuth();
  const [status, setStatus] = useState<MySubscriptionStatus | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [, forceTick] = useState(0);

  useEffect(() => {
    apiFetch<MySubscriptionStatus | null>(`/subscriptions/users/${userId}`)
      .then(setStatus)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
        setStatus(null);
      });
  }, [userId]);

  // Tick mỗi giây để đếm ngược chạy sống động, chỉ khi đang có gói ACTIVE hiển thị.
  useEffect(() => {
    if (!status) return;
    const interval = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  async function handleRevoke() {
    if (!confirm("Thu hồi gói Subscription của user này ngay bây giờ?")) return;
    setError(null);
    setRevoking(true);
    try {
      await apiFetch(`/subscriptions/users/${userId}/revoke`, { method: "POST" });
      setStatus(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setRevoking(false);
    }
  }

  if (status === undefined || status === null) {
    return error ? <ErrorBanner message={error} /> : null;
  }

  const countdown = formatCountdown(status.endsAt);
  const totalRemaining =
    status.plan.totalDownloadLimit === null
      ? null
      : Math.max(status.plan.totalDownloadLimit - status.totalDownloadsUsed, 0);
  const dailyRemaining =
    status.plan.dailyDownloadLimit === null
      ? null
      : Math.max(status.plan.dailyDownloadLimit - status.dailyDownloadsUsed, 0);
  const canRevoke =
    viewer?.id !== userId && !!viewer?.permissionKeys?.includes(PERMISSIONS.SUBSCRIPTION_REVOKE);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
          <Crown size={15} className="text-[#ffcf3f]" aria-hidden />
          Subscription — {status.plan.name}
        </p>
        {canRevoke && (
          <button
            type="button"
            onClick={handleRevoke}
            disabled={revoking}
            className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {revoking ? "Đang thu hồi..." : "Thu hồi"}
          </button>
        )}
      </div>

      <ErrorBanner message={error} />

      <div className="rounded-md border border-[#1d3557]/20 bg-[#1d3557]/5 p-3 text-sm text-zinc-700">
        {countdown ? (
          <p>
            Còn lại: <span className="font-mono font-semibold text-[#1d3557]">{countdown}</span>
          </p>
        ) : (
          <p className="font-semibold text-zinc-500">Đã hết hạn</p>
        )}
        <p className="mt-1 text-xs text-zinc-500">
          Hết hạn lúc {new Date(status.endsAt).toLocaleString("vi-VN")}
        </p>
        <p className="mt-2">
          Đã tải: <span className="font-mono">{status.totalDownloadsUsed}</span>
          {status.plan.totalDownloadLimit !== null && `/${status.plan.totalDownloadLimit}`} lượt
          {totalRemaining !== null && (
            <span className="text-zinc-500"> (còn {totalRemaining} lượt)</span>
          )}
        </p>
        {status.plan.dailyDownloadLimit !== null && (
          <p>
            Hôm nay: <span className="font-mono">{status.dailyDownloadsUsed}</span>/
            {status.plan.dailyDownloadLimit} lượt
            {dailyRemaining !== null && (
              <span className="text-zinc-500"> (còn {dailyRemaining} lượt)</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
