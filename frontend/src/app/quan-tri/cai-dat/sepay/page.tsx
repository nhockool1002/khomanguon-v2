"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { SepayConfigPublic, TopupPreset } from "@/lib/types";
import { ErrorBanner, SuccessBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

export default function AdminSepaySettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [config, setConfig] = useState<SepayConfigPublic | null>(null);
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [webhookApiKey, setWebhookApiKey] = useState("");
  const [apiAccessToken, setApiAccessToken] = useState("");
  const [baseRateVndPerP, setBaseRateVndPerP] = useState(100);
  const [presets, setPresets] = useState<TopupPreset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewVnd, setPreviewVnd] = useState(100000);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const reload = useCallback(() => {
    apiFetch<SepayConfigPublic>("/sepay/config")
      .then((res) => {
        setConfig(res);
        setBankAccountNumber(res.bankAccountNumber);
        setBankName(res.bankName);
        setAccountHolderName(res.accountHolderName);
        setBaseRateVndPerP(res.baseRateVndPerP);
        setPresets(res.presets);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
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
      const payload: Record<string, unknown> = {
        bankAccountNumber,
        bankName,
        accountHolderName,
        baseRateVndPerP,
        presets,
      };
      if (webhookApiKey) payload.webhookApiKey = webhookApiKey;
      if (apiAccessToken) payload.apiAccessToken = apiAccessToken;
      const res = await apiFetch<SepayConfigPublic>("/sepay/config", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setConfig(res);
      setWebhookApiKey("");
      setApiAccessToken("");
      setMessage("Đã lưu cấu hình SePay.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTestResult(null);
    setTesting(true);
    try {
      const res = await apiFetch<{ success: boolean; message: string }>("/sepay/config/test-connection", {
        method: "POST",
      });
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, message: err instanceof ApiError ? err.message : "Có lỗi xảy ra" });
    } finally {
      setTesting(false);
    }
  }

  function addPreset() {
    setPresets((p) => [...p, { vnd: 50000, p: 500 }]);
  }

  function updatePreset(index: number, field: "vnd" | "p", value: number) {
    setPresets((prev) => prev.map((preset, i) => (i === index ? { ...preset, [field]: value } : preset)));
  }

  function removePreset(index: number) {
    setPresets((prev) => prev.filter((_, i) => i !== index));
  }

  const inputClass =
    "rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]";

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.SETTINGS_PAYMENT)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Cài đặt SePay</h1>
      <p className="text-sm text-zinc-500">
        Cấu hình nhận nạp tiền qua VietQR + webhook SePay. Webhook URL cần khai trong dashboard SePay:{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">{`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/sepay/webhook`}</code>{" "}
        — chọn chế độ xác thực <strong>API Key</strong>, dán đúng key đã nhập bên dưới.
      </p>

      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tài khoản ngân hàng</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Số tài khoản
            <input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Ngân hàng (theo mã vietqr.app, vd: Vietcombank, MBBank)
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Chủ tài khoản
            <input value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Webhook API Key {config?.hasApiKey && <span className="text-xs text-zinc-400">(để trống nếu không đổi)</span>}
            <input
              type="password"
              value={webhookApiKey}
              onChange={(e) => setWebhookApiKey(e.target.value)}
              placeholder={config?.hasApiKey ? "•••••••• (đã cấu hình)" : "Dán API Key từ dashboard SePay"}
              className={inputClass}
            />
          </label>
        </div>

        {bankAccountNumber && bankName && (
          <div className="flex flex-col items-start gap-2">
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              Xem thử QR với số tiền
              <input
                type="number"
                value={previewVnd}
                onChange={(e) => setPreviewVnd(Number(e.target.value) || 0)}
                className="w-28 rounded border border-zinc-300 px-2 py-1"
              />
              đ
            </label>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://vietqr.app/img?acc=${encodeURIComponent(bankAccountNumber)}&bank=${encodeURIComponent(bankName)}&amount=${previewVnd}&des=XEMTHU`}
              alt="Xem thử QR"
              className="h-40 w-40 rounded-md border border-zinc-200"
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">API Access (kiểm tra kết nối)</p>
        <p className="text-xs text-zinc-500">
          Token này khác với Webhook API Key ở trên — lấy tại dashboard SePay, mục{" "}
          <strong>API Access</strong>. Chỉ dùng để bấm nút &quot;Thử kết nối API&quot; bên dưới cho
          checklist thiết lập của SePay, không phục vụ nghiệp vụ nào khác trong hệ thống.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-700">
            SePay API Access Token{" "}
            {config?.hasApiAccessToken && <span className="text-xs text-zinc-400">(để trống nếu không đổi)</span>}
            <input
              type="password"
              value={apiAccessToken}
              onChange={(e) => setApiAccessToken(e.target.value)}
              placeholder={config?.hasApiAccessToken ? "•••••••• (đã cấu hình)" : "Dán API Access Token từ dashboard SePay"}
              className={inputClass}
            />
          </label>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {testing ? "Đang kiểm tra..." : "Thử kết nối API"}
          </button>
        </div>
        {testResult && (
          <p className={`text-sm ${testResult.success ? "text-emerald-600" : "text-red-600"}`}>
            {testResult.message}
          </p>
        )}
        <p className="text-xs text-zinc-400">
          Lưu ý: nếu vừa dán token mới, bấm &quot;Lưu cấu hình&quot; trước khi &quot;Thử kết nối API&quot; — nút test luôn dùng token đã lưu trong hệ thống.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tỉ giá &amp; gói nạp</p>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Tỉ giá cơ bản (VNĐ / 1 $P)
          <input
            type="number"
            min={1}
            value={baseRateVndPerP}
            onChange={(e) => setBaseRateVndPerP(Number(e.target.value) || 1)}
            className={`${inputClass} max-w-xs`}
          />
        </label>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-700">Gói nạp nhanh (số tiền cụ thể + $P nhận được, có thể khuyến mãi)</p>
          {presets.map((preset, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="number"
                value={preset.vnd}
                onChange={(e) => updatePreset(i, "vnd", Number(e.target.value) || 0)}
                className={`${inputClass} w-32`}
              />
              <span className="text-sm text-zinc-400">đ →</span>
              <input
                type="number"
                value={preset.p}
                onChange={(e) => updatePreset(i, "p", Number(e.target.value) || 0)}
                className={`${inputClass} w-28`}
              />
              <span className="text-sm text-zinc-400">$P</span>
              <button
                type="button"
                onClick={() => removePreset(i)}
                className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-zinc-100"
              >
                xoá
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addPreset}
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
