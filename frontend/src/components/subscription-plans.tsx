"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import type {
  MySubscriptionStatus,
  SubscriptionOrder,
  SubscriptionOrderWithQr,
  SubscriptionPlan,
} from "@/lib/types";
import { ErrorBanner } from "@/components/ui";

const STATUS_LABEL: Record<SubscriptionOrder["status"], string> = {
  PENDING: "Đang chờ thanh toán",
  SUCCESS: "Thành công",
  EXPIRED: "Đã hết hạn",
};

// Không dùng chung poll pattern với TopupOrderCard (wallet-dashboard.tsx, chủ yếu dựa vào
// WebSocket + 1 lần fallback) — Subscription chưa nối WebSocket (tránh đụng vào wallet.gateway.ts
// hiện có), nên poll lặp lại mỗi 3s cho tới khi có kết quả, đơn giản và đủ nhanh cho UX.
const POLL_INTERVAL_MS = 3000;

function formatVnd(n: number): string {
  return n.toLocaleString("vi-VN") + "đ";
}

function formatCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatDaysLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "đã hết hạn";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return `còn ${days} ngày`;
}

export function SubscriptionPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [myStatus, setMyStatus] = useState<MySubscriptionStatus | null>(null);
  const [pending, setPending] = useState<SubscriptionOrderWithQr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creatingPlanId, setCreatingPlanId] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  const reloadStatus = useCallback(() => {
    apiFetch<MySubscriptionStatus | null>("/subscriptions/me")
      .then(setMyStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiFetch<SubscriptionPlan[]>("/subscription-plans")
      .then(setPlans)
      .catch(() => setPlans([]));
    reloadStatus();
  }, [reloadStatus]);

  // Đếm ngược + poll trạng thái đơn đang chờ.
  useEffect(() => {
    if (!pending || pending.order.status !== "PENDING") return;
    const tickInterval = setInterval(() => forceTick((t) => t + 1), 1000);
    const pollInterval = setInterval(() => {
      apiFetch<SubscriptionOrder>(`/subscriptions/orders/${pending.order.id}`)
        .then((order) => {
          setPending((prev) => (prev ? { ...prev, order } : prev));
          if (order.status === "SUCCESS") reloadStatus();
        })
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => {
      clearInterval(tickInterval);
      clearInterval(pollInterval);
    };
  }, [pending, reloadStatus]);

  async function handleSubscribe(plan: SubscriptionPlan) {
    setError(null);
    setCreatingPlanId(plan.id);
    try {
      const result = await apiFetch<SubscriptionOrderWithQr>("/subscriptions/orders", {
        method: "POST",
        body: JSON.stringify({ planId: plan.id }),
      });
      setPending(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setCreatingPlanId(null);
    }
  }

  if (plans.length === 0 && !pending) return null;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
        <Crown size={15} className="text-[#ffcf3f]" aria-hidden />
        Gói Subscription
      </p>

      {myStatus && (
        <div className="rounded-md border border-[#1d3557]/20 bg-[#1d3557]/5 p-3 text-sm text-zinc-700">
          Đang dùng <span className="font-semibold">{myStatus.plan.name}</span> —{" "}
          {formatDaysLeft(myStatus.endsAt)} (hết hạn{" "}
          {new Date(myStatus.endsAt).toLocaleString("vi-VN")})
          <br />
          Đã tải: <span className="font-mono">{myStatus.totalDownloadsUsed}</span>
          {myStatus.plan.totalDownloadLimit !== null && `/${myStatus.plan.totalDownloadLimit}`} lượt
          {myStatus.plan.dailyDownloadLimit !== null && (
            <>
              {" "}
              · hôm nay: <span className="font-mono">{myStatus.dailyDownloadsUsed}</span>/
              {myStatus.plan.dailyDownloadLimit} lượt
            </>
          )}
        </div>
      )}

      <ErrorBanner message={error} />

      {pending ? (
        <SubscriptionOrderCard order={pending} onReset={() => setPending(null)} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 text-center hover:border-[#1d3557]/40"
            >
              <p className="font-semibold text-zinc-900">{plan.name}</p>
              <p className="font-mono text-lg font-bold text-[#1d3557]">
                {formatVnd(plan.priceVnd)}
              </p>
              <p className="text-xs text-zinc-500">{plan.durationDays} ngày</p>
              <p className="text-xs text-zinc-500">
                {plan.totalDownloadLimit === null
                  ? "Tải không giới hạn"
                  : `Tải tối đa ${plan.totalDownloadLimit} lượt`}
                {plan.dailyDownloadLimit !== null && ` (tối đa ${plan.dailyDownloadLimit} lượt/ngày)`}
              </p>
              <button
                type="button"
                onClick={() => handleSubscribe(plan)}
                disabled={creatingPlanId === plan.id}
                className="mt-2 rounded-md bg-[#1d3557] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
              >
                {creatingPlanId === plan.id ? "Đang tạo..." : "Đăng ký"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubscriptionOrderCard({
  order: pending,
  onReset,
}: {
  order: SubscriptionOrderWithQr;
  onReset: () => void;
}) {
  const { order, qrUrl } = pending;
  const isSuccess = order.status === "SUCCESS";
  const isExpired = order.status === "EXPIRED";

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-200 p-6 text-center">
      {isSuccess ? (
        <>
          <p className="text-2xl">✅</p>
          <p className="font-semibold text-emerald-600">
            Kích hoạt gói &quot;{order.plan.name}&quot; thành công!
          </p>
        </>
      ) : isExpired ? (
        <>
          <p className="text-2xl">⏱️</p>
          <p className="font-semibold text-zinc-500">Yêu cầu đã hết hạn</p>
        </>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR chuyển khoản VietQR" className="h-56 w-56 rounded-md border border-zinc-200" />
          <p className="text-sm text-zinc-600">
            Nội dung CK: <span className="font-mono font-semibold text-zinc-900">{order.code}</span>
          </p>
          <p className="text-sm text-zinc-600">
            Gói <span className="font-semibold">{order.plan.name}</span> —{" "}
            <span className="font-semibold">{order.amountVnd.toLocaleString("vi-VN")}đ</span>
          </p>
          <p className="text-xs text-amber-600">
            ⏳ {STATUS_LABEL[order.status]} — hết hạn sau {formatCountdown(order.expiresAt)}
          </p>
        </>
      )}
      <button
        type="button"
        onClick={onReset}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        {isSuccess || isExpired ? "Đóng" : "Huỷ"}
      </button>
    </div>
  );
}
