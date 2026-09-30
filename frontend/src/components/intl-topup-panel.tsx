"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, FileDown } from "lucide-react";
import { API_URL, apiFetch, ApiError, getAccessToken, tryRefresh } from "@/lib/api";
import type { IntlTopupOrder, IntlTopupPublicConfig, IntlTopupStatus } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";

// Nạp $P quốc tế qua Buy Me a Coffee (thẻ Visa/Mastercard/Amex...) — đối soát TAY bởi Admin, API riêng
// /intl-topup/* (không đụng luồng SePay nội địa). Giao diện tiếng Anh cho khách quốc tế.
// Luồng: chọn gói + đồng ý điều khoản -> nhận mã KMN-XXXXXX -> thanh toán trên BMC, dán mã vào lời
// nhắn -> nhập email đã dùng trên BMC + "I have paid" -> chờ Admin duyệt (email + invoice PDF).

const STATUS_LABEL: Record<IntlTopupStatus, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  PENDING: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

const STATUS_TONE: Record<IntlTopupStatus, string> = {
  AWAITING_PAYMENT: "bg-sky-100 text-sky-700",
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-zinc-100 text-zinc-500",
};

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]";

function formatExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

// Tải invoice PDF — endpoint cần Authorization nên không dùng thẻ <a href> trực tiếp được; tự fetch
// blob (thử refresh token 1 lần nếu 401, giống apiFetch).
async function downloadInvoice(order: IntlTopupOrder) {
  const request = () =>
    fetch(`${API_URL}/intl-topup/orders/${order.id}/invoice`, {
      credentials: "include",
      headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
    });
  let res = await request();
  if (res.status === 401 && (await tryRefresh())) res = await request();
  if (!res.ok) throw new Error("Could not download the invoice");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${order.invoiceNumber ?? order.code}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function IntlTopupPanel() {
  const [config, setConfig] = useState<IntlTopupPublicConfig | null>(null);
  const [orders, setOrders] = useState<IntlTopupOrder[]>([]);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [payerEmail, setPayerEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = useCallback(() => {
    apiFetch<IntlTopupOrder[]>("/intl-topup/orders/me")
      .then(setOrders)
      .catch(() => setOrders([]));
  }, []);

  useEffect(() => {
    apiFetch<IntlTopupPublicConfig>("/intl-topup/config")
      .then(setConfig)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load packages"));
    reload();
  }, [reload]);

  // Đơn đang mở để thao tác: đơn vừa tạo/chọn, hoặc tự lấy đơn AWAITING_PAYMENT mới nhất khi quay lại trang.
  const active =
    orders.find((o) => o.id === activeId && o.status === "AWAITING_PAYMENT") ??
    (activeId === null ? orders.find((o) => o.status === "AWAITING_PAYMENT") : undefined);
  const activeBmcUrl =
    active &&
    (config?.packages.find((p) => p.amountUsd === active.amountUsd)?.bmcUrl ?? config?.bmcPageUrl);

  async function run(action: () => Promise<void>) {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function handleCreate() {
    if (!packageId || !acceptTerms) return;
    return run(async () => {
      const order = await apiFetch<IntlTopupOrder>("/intl-topup/orders", {
        method: "POST",
        body: JSON.stringify({ packageId, acceptTerms }),
      });
      setActiveId(order.id);
      setPayerEmail("");
      setAcceptTerms(false);
      reload();
    });
  }

  function handleClaimPaid() {
    if (!active || !payerEmail.trim()) return;
    return run(async () => {
      await apiFetch(`/intl-topup/orders/${active.id}/claim-paid`, {
        method: "POST",
        body: JSON.stringify({ payerEmail: payerEmail.trim() }),
      });
      setMessage(
        `Thanks! Request ${active.code} is now pending review. We'll email you once it's approved.`,
      );
      setActiveId("");
      reload();
    });
  }

  function handleCancel() {
    if (!active || !confirm(`Cancel request ${active.code}?`)) return;
    return run(async () => {
      await apiFetch(`/intl-topup/orders/${active.id}/cancel`, { method: "POST" });
      setActiveId("");
      reload();
    });
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard bị chặn (http/iframe) — user vẫn tự chọn mã để copy được.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5">
        <div>
          <p className="text-sm font-semibold text-zinc-800">Pay with card via Buy Me a Coffee</p>
          <p className="text-xs text-zinc-500">
            Visa, Mastercard, Amex, Apple Pay, Google Pay. Payments are verified manually — $P is added
            after our team confirms your payment.
          </p>
        </div>

        <ErrorBanner message={error} />
        {message && (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        )}

        {active ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-md border border-[#1d3557]/30 bg-[#1d3557]/5 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Your reference code</p>
              <div className="flex items-center gap-2">
                <span className="select-all font-mono text-2xl font-bold text-[#1d3557]">{active.code}</span>
                <button
                  type="button"
                  onClick={() => copyCode(active.code)}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#1d3557] hover:bg-white"
                >
                  <Copy size={12} aria-hidden /> {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-sm text-zinc-700">
                ${active.amountUsd} USD → <span className="font-semibold text-emerald-600">{active.amountP} $P</span>
              </p>
              <p className="text-xs text-zinc-500">Pay and confirm before {formatExpiry(active.expiresAt)}.</p>
            </div>

            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-zinc-700">
              <li>
                Open Buy Me a Coffee and pay exactly <strong>${active.amountUsd} USD</strong>.
              </li>
              <li>
                Paste your reference code <strong className="font-mono">{active.code}</strong> into the
                message field.
              </li>
              <li>Come back here, enter the email you used on Buy Me a Coffee and click &quot;I have paid&quot;.</li>
            </ol>

            {activeBmcUrl && (
              <a
                href={activeBmcUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-md bg-[#ffdd00] px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-[#f5d400]"
              >
                Pay ${active.amountUsd} on Buy Me a Coffee <ExternalLink size={14} aria-hidden />
              </a>
            )}

            <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
              Email used on Buy Me a Coffee
              <input
                type="email"
                value={payerEmail}
                onChange={(e) => setPayerEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClaimPaid}
                disabled={busy || !payerEmail.trim()}
                className="flex-1 rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
              >
                {busy ? "Submitting..." : "I have paid"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={busy}
                className="rounded-md px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : !config ? (
          <p className="text-sm text-zinc-400">Loading...</p>
        ) : config.packages.length === 0 ? (
          <p className="text-sm text-zinc-400">International top-up is not available right now.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              {config.packages.map((pkg) => {
                const selected = packageId === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setPackageId(pkg.id)}
                    className={`flex min-h-[80px] flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 text-center transition-colors ${
                      selected ? "border-[#1d3557] bg-[#1d3557]/5" : "border-zinc-200 hover:border-[#1d3557]/40"
                    }`}
                  >
                    <span className="font-mono text-base font-bold text-[#1d3557]">${pkg.amountUsd}</span>
                    <span className="font-mono text-sm font-semibold text-emerald-600">
                      +{pkg.amountP.toLocaleString("en-US")} $P
                    </span>
                  </button>
                );
              })}
            </div>
            <label className="flex items-start gap-2 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I understand that $P are digital credits for use on KHOMANGUON.ORG, delivered once the payment
                is confirmed, and are <strong>non-refundable</strong>.
              </span>
            </label>
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy || !packageId || !acceptTerms}
              className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
            >
              {busy ? "Creating..." : "Get reference code"}
            </button>
          </div>
        )}
      </div>

      {orders.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="mb-2 text-sm font-semibold text-zinc-800">Your international top-ups</p>
          <div className="flex flex-col">
            {orders.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 py-2 text-sm last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-mono font-medium text-zinc-800">
                    {o.code}{" "}
                    <span className="font-sans font-normal text-zinc-500">
                      · ${o.amountUsd} → {(o.creditedP ?? o.amountP).toLocaleString("en-US")} $P
                    </span>
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {new Date(o.createdAt).toLocaleString("en-GB")}
                    {o.status === "REJECTED" && o.rejectReason && ` · ${o.rejectReason}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[o.status]}`}>
                    {STATUS_LABEL[o.status]}
                  </span>
                  {o.status === "AWAITING_PAYMENT" && o.id !== active?.id && (
                    <button
                      type="button"
                      onClick={() => setActiveId(o.id)}
                      className="text-xs font-medium text-[#1d3557] hover:underline"
                    >
                      Continue
                    </button>
                  )}
                  {o.status === "APPROVED" && o.invoiceNumber && (
                    <button
                      type="button"
                      onClick={() => run(() => downloadInvoice(o))}
                      className="flex items-center gap-1 text-xs font-medium text-[#1d3557] hover:underline"
                    >
                      <FileDown size={12} aria-hidden /> Invoice
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
