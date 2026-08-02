"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useWalletSocket } from "@/lib/socket";
import type {
  TopupOrder,
  TopupOrderWithQr,
  TopupPreset,
  Wallet,
  WalletTransaction,
  WalletTransactionListResponse,
} from "@/lib/types";
import { ErrorBanner } from "@/components/ui";

const STATUS_LABEL: Record<TopupOrder["status"], string> = {
  PENDING: "Đang chờ thanh toán",
  SUCCESS: "Thành công",
  EXPIRED: "Đã hết hạn",
};

const TX_TYPE_LABEL: Record<WalletTransaction["type"], string> = {
  TOPUP: "Nạp tiền",
  PURCHASE: "Mua link tải",
  ADMIN_ADJUST: "Admin điều chỉnh",
  REFUND: "Hoàn tiền",
};

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

export default function WalletTopupPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [presets, setPresets] = useState<TopupPreset[]>([]);
  const [baseRate, setBaseRate] = useState(100);
  const [amountVnd, setAmountVnd] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [pending, setPending] = useState<TopupOrderWithQr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const reloadWallet = useCallback(() => {
    apiFetch<Wallet>("/wallet/me").then(setWallet).catch(() => {});
  }, []);

  const reloadTransactions = useCallback(() => {
    apiFetch<WalletTransactionListResponse>("/wallet/transactions?limit=20")
      .then((res) => setTransactions(res.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    reloadWallet();
    reloadTransactions();
    apiFetch<{ baseRateVndPerP: number; presets: TopupPreset[] }>("/wallet/topup-presets")
      .then((res) => {
        setBaseRate(res.baseRateVndPerP);
        setPresets(res.presets);
      })
      .catch(() => {});
  }, [user, reloadWallet, reloadTransactions]);

  // Đếm ngược cập nhật mỗi giây khi có order đang chờ.
  useEffect(() => {
    if (!pending || pending.order.status !== "PENDING") return;
    const interval = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [pending]);

  useWalletSocket(!!user, (payload) => {
    setWallet((prev) => (prev ? { ...prev, balance: payload.balance } : prev));
    setPending((prev) =>
      prev && prev.order.id === payload.topupOrderId
        ? { ...prev, order: { ...prev.order, status: "SUCCESS" } }
        : prev,
    );
    reloadTransactions();
  });

  // Fallback nếu socket mất kết nối — poll lại 1 lần trạng thái order khi vẫn đang pending.
  useEffect(() => {
    if (!pending || pending.order.status !== "PENDING") return;
    const timeout = setTimeout(() => {
      apiFetch<TopupOrder>(`/wallet/topup/${pending.order.id}`)
        .then((order) => setPending((prev) => (prev ? { ...prev, order } : prev)))
        .catch(() => {});
    }, 5000);
    return () => clearTimeout(timeout);
  }, [pending]);

  async function handleCreateOrder() {
    if (!amountVnd || amountVnd < 10000) {
      setError("Số tiền nạp tối thiểu 10.000đ");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const result = await apiFetch<TopupOrderWithQr>("/wallet/topup", {
        method: "POST",
        body: JSON.stringify({ amountVnd }),
      });
      setPending(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setCreating(false);
    }
  }

  if (loading || !user) {
    return <div className="flex-1 px-6 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-xl font-semibold text-zinc-900">Ví &amp; Nạp tiền</h1>

      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <p className="text-xs uppercase tracking-wide text-zinc-400">Số dư hiện tại</p>
        <p className="font-mono text-2xl font-bold text-[#1d3557]">{wallet?.balance ?? "—"} $P</p>
      </div>

      {pending ? (
        <TopupOrderCard order={pending} onReset={() => setPending(null)} />
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-sm font-semibold text-zinc-800">Nạp nhanh</p>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.vnd}
                type="button"
                onClick={() => {
                  setAmountVnd(preset.vnd);
                  setCustomAmount("");
                }}
                className={`rounded-md border px-3 py-2 text-sm ${
                  amountVnd === preset.vnd
                    ? "border-[#1d3557] bg-[#1d3557]/5 font-semibold text-[#1d3557]"
                    : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {formatVnd(preset.vnd)} → {preset.p} $P
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
            Số tiền tuỳ chọn (VNĐ)
            <input
              type="number"
              min={10000}
              step={1000}
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                const n = Number(e.target.value);
                setAmountVnd(n > 0 ? n : null);
              }}
              placeholder="vd: 200000"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
            />
            {amountVnd && !presets.some((p) => p.vnd === amountVnd) && (
              <span className="text-xs text-zinc-400">
                Tỉ giá cơ bản: {formatVnd(baseRate)} = 1 $P → nhận {Math.floor(amountVnd / baseRate)} $P
              </span>
            )}
          </label>

          <ErrorBanner message={error} />

          <button
            type="button"
            onClick={handleCreateOrder}
            disabled={creating || !amountVnd}
            className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
          >
            {creating ? "Đang tạo..." : "Tạo yêu cầu nạp"}
          </button>
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <p className="mb-3 text-sm font-semibold text-zinc-800">Lịch sử giao dịch</p>
        {transactions.length === 0 ? (
          <p className="text-sm text-zinc-400">Chưa có giao dịch nào.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between border-b border-zinc-100 py-2 text-sm last:border-0"
              >
                <div>
                  <span className="font-medium text-zinc-800">{TX_TYPE_LABEL[tx.type]}</span>
                  <span className="ml-2 text-xs text-zinc-400">
                    {new Date(tx.createdAt).toLocaleString("vi-VN")}
                  </span>
                </div>
                <span className={`font-mono ${tx.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {tx.amount >= 0 ? "+" : ""}
                  {tx.amount} $P
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TopupOrderCard({ order: pending, onReset }: { order: TopupOrderWithQr; onReset: () => void }) {
  const { order, qrUrl } = pending;
  const isSuccess = order.status === "SUCCESS";
  const isExpired = order.status === "EXPIRED";

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-zinc-200 bg-white p-6 text-center">
      {isSuccess ? (
        <>
          <p className="text-2xl">✅</p>
          <p className="font-semibold text-emerald-600">Nạp tiền thành công! +{order.amountP} $P</p>
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
            Số tiền: <span className="font-semibold">{order.amountVnd.toLocaleString("vi-VN")}đ</span> → nhận{" "}
            <span className="font-semibold">{order.amountP} $P</span>
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
        {isSuccess || isExpired ? "Tạo yêu cầu mới" : "Huỷ"}
      </button>
    </div>
  );
}
