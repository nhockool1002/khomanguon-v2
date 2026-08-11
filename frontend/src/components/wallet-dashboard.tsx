"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  Download,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wallet as WalletIcon,
} from "lucide-react";
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
import { SubscriptionPlans } from "@/components/subscription-plans";

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

const TX_TYPE_ICON: Record<WalletTransaction["type"], typeof WalletIcon> = {
  TOPUP: ArrowDownToLine,
  PURCHASE: Download,
  ADMIN_ADJUST: ShieldCheck,
  REFUND: RotateCcw,
};

const TX_TYPE_TONE: Record<WalletTransaction["type"], string> = {
  TOPUP: "bg-emerald-100 text-emerald-700",
  PURCHASE: "bg-zinc-100 text-zinc-700",
  ADMIN_ADJUST: "bg-amber-100 text-amber-700",
  REFUND: "bg-sky-100 text-sky-700",
};

const MIN_TOPUP_VND = 100000;

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

// Dòng mô tả chi tiết theo từng loại giao dịch — phục vụ đối soát (yêu cầu thực tế: phải biết rõ
// nạp bao nhiêu VNĐ, mua link tải bài nào, Admin nào điều chỉnh + lý do gì).
function TransactionDetail({ tx }: { tx: WalletTransaction }) {
  if (tx.type === "TOPUP") {
    return (
      <span>
        {tx.amountVnd ? `Nạp ${formatVnd(tx.amountVnd)} qua SePay` : "Nạp tiền qua SePay"}
      </span>
    );
  }
  if (tx.type === "PURCHASE") {
    if (tx.postSlug) {
      return (
        <Link href={`/bai-viet/${tx.postSlug}`} className="text-[#1d3557] hover:underline">
          {tx.note ?? "Mua link tải"}
        </Link>
      );
    }
    return <span>{tx.note ?? "Mua link tải"}</span>;
  }
  if (tx.type === "ADMIN_ADJUST") {
    return (
      <span>
        {tx.adminDisplayName ? (
          <>
            Admin <span className="font-medium text-zinc-700">{tx.adminDisplayName}</span> điều chỉnh
          </>
        ) : (
          "Admin điều chỉnh"
        )}
        {tx.note && <>: {tx.note}</>}
      </span>
    );
  }
  return <span>{tx.note ?? "Hoàn tiền"}</span>;
}

export function WalletDashboard() {
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
    apiFetch<WalletTransactionListResponse>("/wallet/transactions?limit=30")
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
    if (!amountVnd || amountVnd < MIN_TOPUP_VND) {
      setError(`Số tiền nạp tối thiểu ${formatVnd(MIN_TOPUP_VND)}`);
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
    return <div className="px-6 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-10">
      <div className="flex items-center gap-4 overflow-hidden rounded-lg border border-zinc-200 bg-gradient-to-br from-[#1d3557] to-[#16294a] p-5 text-white">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10">
          <WalletIcon size={22} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-white/60">Số dư hiện tại</p>
          <p className="truncate font-mono text-3xl font-bold">{wallet?.balance ?? "—"} $P</p>
        </div>
      </div>

      <SubscriptionPlans />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Cột trái — xử lý nạp tiền */}
        <div className="flex flex-col gap-4">
          {pending ? (
            <TopupOrderCard order={pending} onReset={() => setPending(null)} />
          ) : (
            <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                <Sparkles size={15} className="text-[#ffcf3f]" aria-hidden />
                Nạp nhanh
              </p>
              {presets.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {presets.map((preset) => {
                    const isBestValue =
                      presets.length > 1 &&
                      preset.p / preset.vnd === Math.max(...presets.map((p) => p.p / p.vnd));
                    const selected = amountVnd === preset.vnd;
                    return (
                      <button
                        key={preset.vnd}
                        type="button"
                        onClick={() => {
                          setAmountVnd(preset.vnd);
                          setCustomAmount("");
                        }}
                        className={`relative flex min-h-[92px] flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 text-center transition-colors ${
                          selected
                            ? "border-[#1d3557] bg-[#1d3557]/5"
                            : isBestValue
                              ? "border-[#ffcf3f] bg-[#fffaf0] hover:border-[#ff5da2]"
                              : "border-zinc-200 hover:border-[#1d3557]/40"
                        }`}
                      >
                        {isBestValue && (
                          <span className="absolute -top-2.5 right-1/2 translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-[#ff5da2] to-[#ffcf3f] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                            Tốt nhất
                          </span>
                        )}
                        <span className="whitespace-nowrap font-mono text-base font-bold text-[#1d3557]">
                          {formatVnd(preset.vnd)}
                        </span>
                        <span className="whitespace-nowrap font-mono text-sm font-semibold text-emerald-600">
                          +{preset.p} $P
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
                Số tiền tuỳ chọn (VNĐ) — tối thiểu {formatVnd(MIN_TOPUP_VND)}
                <input
                  type="number"
                  min={MIN_TOPUP_VND}
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
        </div>

        {/* Cột phải — lịch sử nạp tiền & dùng $P, luôn kèm số dư sau giao dịch để đối soát */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-zinc-800">Lịch sử giao dịch</p>
          {transactions.length === 0 ? (
            <p className="text-sm text-zinc-400">Chưa có giao dịch nào.</p>
          ) : (
            <div className="flex max-h-[560px] flex-col gap-2 overflow-y-auto">
              {transactions.map((tx) => {
                const Icon = TX_TYPE_ICON[tx.type];
                return (
                  <div
                    key={tx.id}
                    className="flex items-start gap-3 border-b border-zinc-100 py-2.5 text-sm last:border-0"
                  >
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${TX_TYPE_TONE[tx.type]}`}>
                      <Icon size={14} strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-zinc-800">{TX_TYPE_LABEL[tx.type]}</span>
                        <span className={`font-mono text-xs font-semibold ${tx.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {tx.amount >= 0 ? "+" : ""}
                          {tx.amount} $P
                        </span>
                      </div>
                      <p className="truncate text-xs text-zinc-500">
                        <TransactionDetail tx={tx} />
                      </p>
                      <div className="mt-0.5 flex items-center justify-between text-[11px] text-zinc-400">
                        <span>{new Date(tx.createdAt).toLocaleString("vi-VN")}</span>
                        <span className="font-mono">Số dư sau GD: {tx.balanceAfter} $P</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
