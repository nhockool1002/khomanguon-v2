"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { API_URL, apiFetch, ApiError, getAccessToken, tryRefresh } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { AdminIntlTopupOrder, IntlTopupStatus } from "@/lib/types";
import { ErrorBanner, FormField, SubmitButton, SuccessBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<IntlTopupStatus, string> = {
  AWAITING_PAYMENT: "Chờ user thanh toán",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  EXPIRED: "Hết hạn / huỷ",
};

const STATUS_COLOR: Record<IntlTopupStatus, string> = {
  AWAITING_PAYMENT: "bg-sky-100 text-sky-700",
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-zinc-100 text-zinc-500",
};

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]";

function fmt(date: string | null): string {
  return date ? new Date(date).toLocaleString("vi-VN") : "—";
}

// $P đề xuất theo đúng tỉ lệ $P/USD của gói user đã chọn — Admin sửa tay được.
function suggestP(order: AdminIntlTopupOrder, receivedUsd: number): number {
  return Math.round((receivedUsd * order.amountP) / order.amountUsd);
}

async function downloadInvoice(order: AdminIntlTopupOrder) {
  const request = () =>
    fetch(`${API_URL}/intl-topup/orders/${order.id}/invoice`, {
      credentials: "include",
      headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
    });
  let res = await request();
  if (res.status === 401 && (await tryRefresh())) res = await request();
  if (!res.ok) throw new Error("Không tải được invoice");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${order.invoiceNumber ?? order.code}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// Hàng đợi duyệt nạp quốc tế (Buy Me a Coffee) — Admin đối chiếu mã KMN-/số USD/email trên ví BMC rồi
// Duyệt (cộng $P + gửi invoice PDF cho user & Admin) hoặc Từ chối (kèm lý do, mail user).
export default function AdminIntlTopupPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AdminIntlTopupOrder[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<IntlTopupStatus | "">("PENDING");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Form đang mở (chỉ 1 tại 1 thời điểm) — duyệt hoặc từ chối.
  const [openForm, setOpenForm] = useState<{ id: string; kind: "approve" | "reject" } | null>(null);
  const [receivedUsd, setReceivedUsd] = useState("");
  const [creditedP, setCreditedP] = useState("");
  const [bmcRef, setBmcRef] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const reload = useCallback(() => {
    const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (statusFilter) query.set("status", statusFilter);
    if (q) query.set("q", q);
    apiFetch<{ items: AdminIntlTopupOrder[]; total: number }>(`/intl-topup/admin/orders?${query.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [page, statusFilter, q]);

  useEffect(() => {
    if (!user) return;
    reload();
  }, [user, reload]);

  function openApprove(order: AdminIntlTopupOrder) {
    setOpenForm({ id: order.id, kind: "approve" });
    setReceivedUsd(String(order.amountUsd));
    setCreditedP(String(order.amountP));
    setBmcRef("");
  }

  function openReject(order: AdminIntlTopupOrder) {
    setOpenForm({ id: order.id, kind: "reject" });
    setReason("");
  }

  async function submit(order: AdminIntlTopupOrder) {
    if (!openForm) return;
    setError(null);
    setMessage(null);
    setBusyId(order.id);
    try {
      if (openForm.kind === "approve") {
        if (!confirm(`Xác nhận đã nhận $${receivedUsd} trên BMC và cộng ${creditedP} $P cho ${order.user.displayName}?`)) {
          return;
        }
        const res = await apiFetch<{ mailError: string | null }>(`/intl-topup/admin/orders/${order.id}/approve`, {
          method: "POST",
          body: JSON.stringify({
            receivedUsd: Number(receivedUsd),
            creditedP: Number(creditedP),
            bmcTransactionRef: bmcRef.trim(),
          }),
        });
        setMessage(
          res.mailError
            ? `Đã duyệt ${order.code} và cộng ${creditedP} $P — nhưng gửi email/invoice thất bại: ${res.mailError}`
            : `Đã duyệt ${order.code}, cộng ${creditedP} $P và gửi invoice cho ${order.user.email}.`,
        );
      } else {
        await apiFetch(`/intl-topup/admin/orders/${order.id}/reject`, {
          method: "POST",
          body: JSON.stringify({ reason: reason.trim() }),
        });
        setMessage(`Đã từ chối ${order.code}.`);
      }
      setOpenForm(null);
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
  if (!user.permissionKeys?.includes(PERMISSIONS.PAYMENT_INTL_MANAGE)) {
    return <ForbiddenPage />;
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const approveValid =
    Number(receivedUsd) > 0 && Number.isInteger(Number(creditedP)) && Number(creditedP) > 0 && bmcRef.trim().length >= 3;

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Duyệt nạp quốc tế (Buy Me a Coffee)</h1>
      <p className="text-sm text-zinc-500">
        Đối chiếu <strong>mã giao dịch</strong> (trong lời nhắn), <strong>số USD</strong> và <strong>email</strong> trên
        ví Buy Me a Coffee trước khi duyệt. Duyệt sẽ cộng $P ngay và gửi invoice PDF cho user + email thông báo Admin.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(qInput.trim());
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
          Trạng thái
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as IntlTopupStatus | "");
            }}
            className={inputClass}
          >
            <option value="">Tất cả trạng thái</option>
            {(Object.keys(STATUS_LABEL) as IntlTopupStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <FormField
          label="Tìm theo mã / email / user / mã BMC"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="KMN-..."
        />
        <SubmitButton type="submit">Áp dụng</SubmitButton>
      </form>

      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      {items && items.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Không có yêu cầu nào.
        </p>
      )}

      {items && items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((o) => (
            <div key={o.id} className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="select-all font-mono text-base font-bold text-[#1d3557]">{o.code}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[o.status]}`}>
                  {STATUS_LABEL[o.status]}
                </span>
                <span className="text-sm text-zinc-700">
                  ${o.amountUsd} USD → <span className="font-semibold text-emerald-600">{o.amountP} $P</span>
                </span>
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 text-xs text-zinc-500 sm:grid-cols-2">
                <span>
                  User: <span className="font-medium text-zinc-800">{o.user.displayName}</span> ({o.user.email})
                </span>
                <span>
                  Email trên BMC: <span className="font-medium text-zinc-800">{o.payerEmail ?? "—"}</span>
                </span>
                <span>Tạo lúc: {fmt(o.createdAt)}</span>
                <span>User báo đã trả: {fmt(o.paidClaimedAt)}</span>
                {o.status === "APPROVED" && (
                  <>
                    <span>
                      Thực nhận: ${((o.receivedUsdCents ?? 0) / 100).toFixed(2)} · Đã cộng {o.creditedP} $P
                    </span>
                    <span>Mã BMC: {o.bmcTransactionRef}</span>
                  </>
                )}
                {(o.status === "APPROVED" || o.status === "REJECTED") && (
                  <span>
                    {o.status === "APPROVED" ? "Duyệt" : "Từ chối"} bởi {o.reviewedBy?.displayName ?? "—"} lúc{" "}
                    {fmt(o.reviewedAt)}
                  </span>
                )}
                {o.status === "REJECTED" && o.rejectReason && <span>Lý do: {o.rejectReason}</span>}
              </div>

              {o.status === "PENDING" && openForm?.id !== o.id && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openApprove(o)}
                    className="rounded px-2 py-0.5 text-xs font-medium text-emerald-600 hover:bg-zinc-100"
                  >
                    Duyệt & cộng $P
                  </button>
                  <button
                    type="button"
                    onClick={() => openReject(o)}
                    className="rounded px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-zinc-100"
                  >
                    Từ chối
                  </button>
                </div>
              )}
              {o.status === "APPROVED" && o.invoiceNumber && (
                <button
                  type="button"
                  onClick={() => downloadInvoice(o).catch((err: Error) => setError(err.message))}
                  className="self-start rounded px-2 py-0.5 text-xs font-medium text-[#1d3557] hover:bg-zinc-100"
                >
                  Tải invoice {o.invoiceNumber}
                </button>
              )}

              {openForm?.id === o.id && openForm.kind === "approve" && (
                <div className="flex flex-col gap-2 rounded-md border border-emerald-300 bg-emerald-50/50 p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="flex flex-col gap-1 text-xs text-zinc-600">
                      USD thực nhận trên BMC
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={receivedUsd}
                        onChange={(e) => {
                          setReceivedUsd(e.target.value);
                          const n = Number(e.target.value);
                          if (n > 0) setCreditedP(String(suggestP(o, n)));
                        }}
                        className={inputClass}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-600">
                      $P cộng cho user (sửa được)
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={creditedP}
                        onChange={(e) => setCreditedP(e.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-600">
                      Mã giao dịch trên BMC
                      <input
                        value={bmcRef}
                        onChange={(e) => setBmcRef(e.target.value)}
                        placeholder="Mã / ID giao dịch BMC"
                        className={inputClass}
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => submit(o)}
                      disabled={busyId === o.id || !approveValid}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {busyId === o.id ? "Đang xử lý..." : "Xác nhận đã nhận tiền"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenForm(null)}
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
                    >
                      Huỷ
                    </button>
                  </div>
                </div>
              )}

              {openForm?.id === o.id && openForm.kind === "reject" && (
                <div className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50/50 p-3">
                  <label className="flex flex-col gap-1 text-xs text-zinc-600">
                    Lý do từ chối (gửi cho user, nên viết tiếng Anh)
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      placeholder="No matching payment found on Buy Me a Coffee."
                      className={`${inputClass} resize-y`}
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => submit(o)}
                      disabled={busyId === o.id || reason.trim().length < 3}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {busyId === o.id ? "Đang xử lý..." : "Từ chối yêu cầu"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenForm(null)}
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
                    >
                      Huỷ
                    </button>
                  </div>
                </div>
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
