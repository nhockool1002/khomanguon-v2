"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { IntlPaymentAdminSettings } from "@/lib/types";
import { ErrorBanner, SuccessBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]";

interface PackageRow {
  amountUsd: number;
  amountP: number;
  bmcExtraUrl: string;
  isActive: boolean;
}

// Cài đặt nạp quốc tế qua Buy Me a Coffee — tách hẳn khỏi trang Cài đặt SePay. Tỉ giá cơ bản VNĐ/$P
// chỉ HIỂN THỊ (đọc từ cấu hình SePay) để tính $P mặc định: $P = USD × tỉ giá USD→VNĐ ÷ VNĐ/$P.
export default function AdminIntlPaymentSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [baseRate, setBaseRate] = useState(100);
  const [bmcPageUrl, setBmcPageUrl] = useState("");
  const [usdToVndRate, setUsdToVndRate] = useState(27000);
  const [paymentWindowHours, setPaymentWindowHours] = useState(24);
  const [maxOpenOrdersPerUser, setMaxOpenOrdersPerUser] = useState(3);
  const [sellerName, setSellerName] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const apply = useCallback((res: IntlPaymentAdminSettings) => {
    setBaseRate(res.domesticBaseRateVndPerP);
    setBmcPageUrl(res.bmcPageUrl);
    setUsdToVndRate(res.usdToVndRate);
    setPaymentWindowHours(res.paymentWindowHours);
    setMaxOpenOrdersPerUser(res.maxOpenOrdersPerUser);
    setSellerName(res.sellerName);
    setSellerEmail(res.sellerEmail);
    setPackages(
      res.packages.map((p) => ({
        amountUsd: p.amountUsd,
        amountP: p.amountP,
        bmcExtraUrl: p.bmcExtraUrl ?? "",
        isActive: p.isActive,
      })),
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    apiFetch<IntlPaymentAdminSettings>("/intl-topup/admin/settings")
      .then(apply)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [user, apply]);

  const defaultP = (usd: number) => Math.floor((usd * usdToVndRate) / baseRate);

  function updatePackage(i: number, patch: Partial<PackageRow>) {
    setPackages((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  async function handleSave() {
    setError(null);
    setMessage(null);
    if (packages.some((p) => p.amountUsd < 1 || p.amountP < 1)) {
      setError("Mỗi gói cần số USD và $P lớn hơn 0.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<IntlPaymentAdminSettings>("/intl-topup/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          bmcPageUrl: bmcPageUrl.trim(),
          usdToVndRate,
          paymentWindowHours,
          maxOpenOrdersPerUser,
          sellerName: sellerName.trim(),
          sellerEmail: sellerEmail.trim(),
          packages: packages.map((p) => ({
            amountUsd: p.amountUsd,
            amountP: p.amountP,
            bmcExtraUrl: p.bmcExtraUrl.trim() || undefined,
            isActive: p.isActive,
          })),
        }),
      });
      apply(res);
      setMessage("Đã lưu cấu hình thanh toán quốc tế.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.PAYMENT_INTL_MANAGE)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Cài đặt thanh toán quốc tế</h1>
      <p className="text-sm text-zinc-500">
        Khách quốc tế thanh toán thẻ qua <strong>Buy Me a Coffee</strong> (Extras), Admin đối soát tay ở trang Duyệt
        nạp quốc tế. Hoàn toàn tách biệt với luồng SePay nội địa.
      </p>

      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Buy Me a Coffee</p>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Link trang BMC (dùng khi gói chưa có link Extras riêng)
          <input value={bmcPageUrl} onChange={(e) => setBmcPageUrl(e.target.value)} className={inputClass} />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Hạn thanh toán (giờ)
            <input
              type="number"
              min={1}
              max={720}
              value={paymentWindowHours}
              onChange={(e) => setPaymentWindowHours(Number(e.target.value) || 1)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Số yêu cầu đang mở tối đa / user
            <input
              type="number"
              min={1}
              max={20}
              value={maxOpenOrdersPerUser}
              onChange={(e) => setMaxOpenOrdersPerUser(Number(e.target.value) || 1)}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Thông tin người bán (in trên invoice)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Tên
            <input value={sellerName} onChange={(e) => setSellerName(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Email
            <input
              type="email"
              value={sellerEmail}
              onChange={(e) => setSellerEmail(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tỉ giá &amp; gói nạp quốc tế</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Tỉ giá USD → VNĐ (1 USD = ? đ)
            <input
              type="number"
              min={1}
              value={usdToVndRate}
              onChange={(e) => setUsdToVndRate(Number(e.target.value) || 1)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Tỉ giá cơ bản VNĐ / 1 $P (theo Cài đặt SePay)
            <input value={baseRate} readOnly className={`${inputClass} bg-zinc-50 text-zinc-500`} />
          </label>
        </div>
        <p className="text-xs text-zinc-500">
          $P mặc định = USD × {usdToVndRate.toLocaleString("vi-VN")} ÷ {baseRate} → 1 USD ={" "}
          {defaultP(1).toLocaleString("vi-VN")} $P. Nhập số USD sẽ tự điền $P theo công thức này, có thể sửa tay
          (khuyến mãi).
        </p>

        <div className="flex flex-col gap-2">
          {packages.map((pkg, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-zinc-400">$</span>
              <input
                type="number"
                min={1}
                value={pkg.amountUsd}
                onChange={(e) => {
                  const usd = Number(e.target.value) || 0;
                  updatePackage(i, { amountUsd: usd, amountP: defaultP(usd) });
                }}
                className={`${inputClass} w-24`}
              />
              <span className="text-sm text-zinc-400">→</span>
              <input
                type="number"
                min={1}
                value={pkg.amountP}
                onChange={(e) => updatePackage(i, { amountP: Number(e.target.value) || 0 })}
                className={`${inputClass} w-28`}
              />
              <span className="text-sm text-zinc-400">$P</span>
              <input
                value={pkg.bmcExtraUrl}
                onChange={(e) => updatePackage(i, { bmcExtraUrl: e.target.value })}
                placeholder="Link Extras trên BMC (tuỳ chọn)"
                className={`${inputClass} min-w-0 flex-1`}
              />
              <label className="flex items-center gap-1 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={pkg.isActive}
                  onChange={(e) => updatePackage(i, { isActive: e.target.checked })}
                />
                Bật
              </label>
              <button
                type="button"
                onClick={() => setPackages((prev) => prev.filter((_, idx) => idx !== i))}
                className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-zinc-100"
              >
                xoá
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setPackages((prev) => [...prev, { amountUsd: 10, amountP: defaultP(10), bmcExtraUrl: "", isActive: true }])
            }
            className="w-fit rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            + Thêm gói
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-fit rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
      >
        {saving ? "Đang lưu..." : "Lưu cấu hình"}
      </button>
    </div>
  );
}
