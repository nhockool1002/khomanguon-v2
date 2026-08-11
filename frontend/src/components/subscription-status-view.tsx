"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import type { MySubscriptionStatus } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";

function formatDaysLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "đã hết hạn";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return `còn ${days} ngày`;
}

// Xem (chỉ đọc, không có nút mua) trạng thái Subscription của MỘT USER KHÁC — dùng ở tab
// "Subscription" trang Hồ sơ khi viewer có quyền subscription.view_any (Admin/Super Moderator...).
// Khác SubscriptionPlans (subscription-plans.tsx, dùng cho chính chủ, có luồng mua gói qua SePay).
export function SubscriptionStatusView({ userId }: { userId: string }) {
  const [status, setStatus] = useState<MySubscriptionStatus | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<MySubscriptionStatus | null>(`/subscriptions/users/${userId}`)
      .then(setStatus)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
        setStatus(null);
      });
  }, [userId]);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
        <Crown size={15} className="text-[#ffcf3f]" aria-hidden />
        Subscription
      </p>

      <ErrorBanner message={error} />

      {status === undefined && <p className="text-sm text-zinc-400">Đang tải...</p>}

      {status === null && !error && (
        <p className="text-sm text-zinc-500">User này hiện không có gói Subscription nào.</p>
      )}

      {status && (
        <div className="rounded-md border border-[#1d3557]/20 bg-[#1d3557]/5 p-3 text-sm text-zinc-700">
          Đang dùng <span className="font-semibold">{status.plan.name}</span> —{" "}
          {formatDaysLeft(status.endsAt)} (hết hạn{" "}
          {new Date(status.endsAt).toLocaleString("vi-VN")})
          <br />
          Đã tải: <span className="font-mono">{status.totalDownloadsUsed}</span>
          {status.plan.totalDownloadLimit !== null && `/${status.plan.totalDownloadLimit}`} lượt
          {status.plan.dailyDownloadLimit !== null && (
            <>
              {" "}
              · hôm nay: <span className="font-mono">{status.dailyDownloadsUsed}</span>/
              {status.plan.dailyDownloadLimit} lượt
            </>
          )}
        </div>
      )}
    </div>
  );
}
