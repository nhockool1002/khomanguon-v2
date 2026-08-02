"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import type { AdminWalletTransaction, WalletTxStatus, WalletTxType } from "@/lib/types";
import { ErrorBanner, FormField, SubmitButton, SuccessBanner } from "@/components/ui";

const PAGE_SIZE = 20;

const TYPE_LABEL: Record<WalletTxType, string> = {
  TOPUP: "Nạp tiền",
  PURCHASE: "Mua hàng",
  ADMIN_ADJUST: "Admin điều chỉnh",
  REFUND: "Hoàn tiền",
};

const TYPE_BADGE: Record<WalletTxType, string> = {
  TOPUP: "bg-emerald-100 text-emerald-700",
  PURCHASE: "bg-zinc-100 text-zinc-700",
  ADMIN_ADJUST: "bg-amber-100 text-amber-700",
  REFUND: "bg-sky-100 text-sky-700",
};

const STATUS_LABEL: Record<WalletTxStatus, string> = {
  PENDING: "Đang chờ",
  SUCCESS: "Thành công",
  FAILED: "Thất bại",
};

const STATUS_BADGE: Record<WalletTxStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  SUCCESS: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
};

function formatP(amount: number): string {
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount.toLocaleString("vi-VN")} $P`;
}

export default function AdminWalletTransactionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<AdminWalletTransaction[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");

  const [adjustEmail, setAdjustEmail] = useState("");
  const [adjustDirection, setAdjustDirection] = useState<"credit" | "debit">("credit");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const reload = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    apiFetch<{ items: AdminWalletTransaction[]; total: number }>(
      `/wallet/admin/transactions?${params.toString()}`,
    )
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [page, type, status, q]);

  useEffect(() => {
    if (!user) return;
    reload();
  }, [user, reload]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQ(qInput.trim());
  }

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const rawAmount = Number(adjustAmount);
    if (!adjustEmail.trim() || !rawAmount || rawAmount <= 0) {
      setError("Nhập email hợp lệ và số $P lớn hơn 0.");
      return;
    }
    const amount = adjustDirection === "credit" ? rawAmount : -rawAmount;
    setAdjustBusy(true);
    try {
      await apiFetch("/wallet/admin/adjust", {
        method: "POST",
        body: JSON.stringify({ userEmail: adjustEmail.trim(), amount, note: adjustNote.trim() || undefined }),
      });
      setMessage(`Đã ${adjustDirection === "credit" ? "cộng" : "trừ"} ${rawAmount.toLocaleString("vi-VN")} $P cho ${adjustEmail.trim()}.`);
      setAdjustEmail("");
      setAdjustAmount("");
      setAdjustNote("");
      setPage(1);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setAdjustBusy(false);
    }
  }

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="flex w-full flex-col gap-4 px-8 py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Quản lý giao dịch ($P)</h1>
      <p className="text-sm text-zinc-500">
        Sổ dòng tiền $P toàn hệ thống — nạp tiền, mua hàng, hoàn tiền và điều chỉnh tay. Dùng để đối
        soát thủ công khi webhook SePay không khớp trước khi liên hệ hỗ trợ.
      </p>

      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      <form
        onSubmit={submitAdjust}
        className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-zinc-900">Điều chỉnh số dư thủ công</h2>
        <div className="flex flex-wrap items-end gap-3">
          <FormField
            label="Email user"
            type="email"
            value={adjustEmail}
            onChange={(e) => setAdjustEmail(e.target.value)}
            placeholder="user@example.com"
            required
          />
          <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
            Loại
            <select
              value={adjustDirection}
              onChange={(e) => setAdjustDirection(e.target.value as "credit" | "debit")}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
            >
              <option value="credit">Cộng $P</option>
              <option value="debit">Trừ $P</option>
            </select>
          </label>
          <FormField
            label="Số $P"
            type="number"
            min={1}
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            placeholder="100"
            required
          />
          <FormField
            label="Ghi chú (tuỳ chọn)"
            value={adjustNote}
            onChange={(e) => setAdjustNote(e.target.value)}
            placeholder="Lý do điều chỉnh..."
          />
          <SubmitButton type="submit" loading={adjustBusy}>
            Thực hiện
          </SubmitButton>
        </div>
      </form>

      <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
          Loại giao dịch
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          >
            <option value="">Tất cả</option>
            {(Object.keys(TYPE_LABEL) as WalletTxType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
          Trạng thái
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          >
            <option value="">Tất cả</option>
            {(Object.keys(STATUS_LABEL) as WalletTxStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <FormField
          label="Tìm theo email / tên"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="nhut@..."
        />
        <SubmitButton type="submit">Áp dụng</SubmitButton>
      </form>

      {items && items.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Chưa có giao dịch nào khớp bộ lọc.
        </p>
      )}

      {items && items.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Thời gian</th>
                <th className="px-3 py-2">Người dùng</th>
                <th className="px-3 py-2">Loại</th>
                <th className="px-3 py-2">Số tiền</th>
                <th className="px-3 py-2">Số dư sau GD</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Ghi chú / Tham chiếu</th>
              </tr>
            </thead>
            <tbody>
              {items.map((tx) => (
                <tr key={tx.id} className="border-t border-zinc-100 align-top">
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {new Date(tx.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-zinc-800">{tx.user.displayName}</div>
                    <div className="font-mono text-xs text-zinc-500">{tx.user.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[tx.type]}`}>
                      {TYPE_LABEL[tx.type]}
                    </span>
                  </td>
                  <td
                    className={`px-3 py-2 font-mono text-xs font-medium ${
                      tx.amount >= 0 ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {formatP(tx.amount)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-700">
                    {tx.balanceAfter.toLocaleString("vi-VN")} $P
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[tx.status]}`}>
                      {STATUS_LABEL[tx.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {tx.note && <div className="text-zinc-700">{tx.note}</div>}
                    {tx.referenceType && (
                      <div className="font-mono text-[11px] text-zinc-400">
                        {tx.referenceType}
                        {tx.referenceId ? `:${tx.referenceId}` : ""}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
