"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { GeneralSettings, StorageProvider, StorageProviderType } from "@/lib/types";
import { ErrorBanner, SuccessBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

interface FormValues {
  type: StorageProviderType;
  label: string;
  endpoint: string;
  region: string;
  bucket: string;
  uploadPrefix: string;
  publicBaseUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
  isDefault: boolean;
}

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]";

const EMPTY_FORM: FormValues = {
  type: "R2",
  label: "",
  endpoint: "",
  region: "",
  bucket: "",
  uploadPrefix: "",
  publicBaseUrl: "",
  accessKeyId: "",
  secretAccessKey: "",
  isDefault: false,
};

export default function AdminStorageProvidersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [providers, setProviders] = useState<StorageProvider[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<StorageProvider | null | "new">(null);

  const [gaTrackingId, setGaTrackingId] = useState("");
  const [googleSiteVerification, setGoogleSiteVerification] = useState("");
  const [seoMessage, setSeoMessage] = useState<string | null>(null);
  const [savingSeo, setSavingSeo] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    reload();
    apiFetch<GeneralSettings>("/settings/general")
      .then((res) => {
        setGaTrackingId(res.gaTrackingId);
        setGoogleSiteVerification(res.googleSiteVerification);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [user]);

  async function handleSaveSeo() {
    setError(null);
    setSeoMessage(null);
    setSavingSeo(true);
    try {
      await apiFetch<GeneralSettings>("/settings/general", {
        method: "PUT",
        body: JSON.stringify({ gaTrackingId, googleSiteVerification }),
      });
      setSeoMessage("Đã lưu cấu hình SEO toàn site.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSavingSeo(false);
    }
  }

  async function reload() {
    try {
      setProviders(await apiFetch<StorageProvider[]>("/storage-providers"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleDelete(provider: StorageProvider) {
    if (!confirm(`Xoá storage provider "${provider.label}"?`)) return;
    setError(null);
    try {
      await apiFetch(`/storage-providers/${provider.id}`, { method: "DELETE" });
      if (editing !== "new" && editing?.id === provider.id) setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleSave(values: FormValues) {
    setError(null);
    const payload: Record<string, unknown> = {
      type: values.type,
      label: values.label,
      endpoint: values.endpoint || undefined,
      region: values.region || undefined,
      bucket: values.type === "MAILJET" ? undefined : values.bucket,
      uploadPrefix: values.uploadPrefix || undefined,
      publicBaseUrl: values.type === "MAILJET" ? undefined : values.publicBaseUrl || undefined,
      accessKeyId: values.accessKeyId,
      isDefault: values.isDefault,
    };
    // Để trống secret khi sửa = không đổi (xem UpdateStorageProviderDto) — chỉ gửi khi có nhập.
    if (values.secretAccessKey) payload.secretAccessKey = values.secretAccessKey;

    try {
      if (editing === "new") {
        await apiFetch("/storage-providers", { method: "POST", body: JSON.stringify(payload) });
      } else if (editing) {
        await apiFetch(`/storage-providers/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      }
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.SETTINGS_STORAGE_KEYS)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Cài đặt Provider</h1>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a]"
        >
          + Thêm provider
        </button>
      </div>
      <p className="text-sm text-zinc-500">
        Nhập Access Key/Secret R2/S3 thật ở đây — dùng để sinh link tải (presigned URL) và upload ảnh
        khi migrate. Có thể thêm provider Mailjet để gửi email xác minh/đặt lại mật khẩu. Secret được
        mã hoá trước khi lưu, không hiển thị lại sau khi nhập.
      </p>

      <ErrorBanner message={error} />

      {providers && providers.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Chưa có storage provider nào.
        </p>
      )}

      {providers && providers.length > 0 && (
        <div className="flex flex-col gap-1">
          {providers.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <span className="font-medium text-zinc-800">{p.label}</span>
              <span className="font-mono text-xs text-zinc-400">
                {p.type}
                {p.bucket && ` · ${p.bucket}`}
              </span>
              {p.isDefault && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  Mặc định
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className="rounded px-2 py-0.5 text-xs font-medium text-[#1d3557] hover:bg-zinc-100"
                >
                  sửa
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p)}
                  className="rounded px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-zinc-100"
                >
                  xoá
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <StorageProviderEditPanel
          key={editing === "new" ? "new" : editing.id}
          provider={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          SEO toàn site — Google Analytics &amp; Search Console
        </p>
        <SuccessBanner message={seoMessage} />
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Google Analytics Tracking ID
          <input
            value={gaTrackingId}
            onChange={(e) => setGaTrackingId(e.target.value)}
            placeholder="G-XXXXXXXXXX"
            className={inputClass}
          />
          <span className="text-xs text-zinc-400">
            Để trống thì không gắn Google Analytics vào site.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Google Search Console — mã xác minh
          <input
            value={googleSiteVerification}
            onChange={(e) => setGoogleSiteVerification(e.target.value)}
            placeholder="Nội dung thẻ meta google-site-verification"
            className={inputClass}
          />
          <span className="text-xs text-zinc-400">
            Lấy ở Search Console → Cài đặt → Xác minh quyền sở hữu → HTML tag — chỉ dán phần nội
            dung (content=&quot;...&quot;), không dán cả thẻ.
          </span>
        </label>
        <button
          type="button"
          onClick={handleSaveSeo}
          disabled={savingSeo}
          className="w-fit rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
        >
          {savingSeo ? "Đang lưu..." : "Lưu cấu hình SEO"}
        </button>
      </div>
    </div>
  );
}

function StorageProviderEditPanel({
  provider,
  onCancel,
  onSave,
}: {
  provider: StorageProvider | null;
  onCancel: () => void;
  onSave: (values: FormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<FormValues>(
    provider
      ? {
          type: provider.type,
          label: provider.label,
          endpoint: provider.endpoint ?? "",
          region: provider.region ?? "",
          bucket: provider.bucket ?? "",
          uploadPrefix: provider.uploadPrefix ?? "",
          publicBaseUrl: provider.publicBaseUrl ?? "",
          accessKeyId: provider.accessKeyId,
          secretAccessKey: "",
          isDefault: provider.isDefault,
        }
      : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(values);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {provider ? "Chỉnh sửa storage provider" : "Storage provider mới"}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Loại
          <select value={values.type} onChange={(e) => set("type", e.target.value as StorageProviderType)} className={inputClass}>
            <option value="R2">Cloudflare R2</option>
            <option value="S3">AWS S3</option>
            <option value="MAILJET">Mailjet (gửi email)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Tên hiển thị
          <input value={values.label} onChange={(e) => set("label", e.target.value)} required minLength={2} className={inputClass} />
        </label>
        {values.type !== "MAILJET" && (
          <>
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              {values.type === "R2" ? "Account ID" : "Endpoint (tuỳ chọn)"}
              <input
                value={values.endpoint}
                onChange={(e) => set("endpoint", e.target.value)}
                placeholder={values.type === "R2" ? "vd: 837a9be109f87bab075ea0dd4fe8b62f" : undefined}
                className={inputClass}
              />
              {values.type === "R2" && (
                <span className="text-xs text-zinc-400">
                  Chỉ cần Account ID (xem trong Cloudflare dashboard) — hệ thống tự suy ra endpoint
                  https://accountId.r2.cloudflarestorage.com, không cần dán nguyên URL.
                </span>
              )}
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              Region (S3 dùng)
              <input value={values.region} onChange={(e) => set("region", e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              Bucket
              <input value={values.bucket} onChange={(e) => set("bucket", e.target.value)} required className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              Upload prefix (tuỳ chọn)
              <input value={values.uploadPrefix} onChange={(e) => set("uploadPrefix", e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-700 sm:col-span-2">
              Public Base URL (tuỳ chọn)
              <input
                value={values.publicBaseUrl}
                onChange={(e) => set("publicBaseUrl", e.target.value)}
                placeholder="vd: https://cdn.khomanguon.org hoặc https://pub-xxx.r2.dev"
                className={inputClass}
              />
              <span className="text-xs text-zinc-400">
                Domain public của bucket — chỉ cần điền nếu muốn dùng provider này làm nguồn Thư viện
                Media (ảnh nhúng bài viết cần URL tồn tại vĩnh viễn, không dùng được presigned URL).
                Bỏ trống nếu chỉ dùng cho Quản lý File Cloud/link tải.
              </span>
            </label>
          </>
        )}
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          {values.type === "MAILJET" ? "API Key" : "Access Key ID"}
          <input value={values.accessKeyId} onChange={(e) => set("accessKeyId", e.target.value)} required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          {values.type === "MAILJET" ? "Secret Key" : "Secret Access Key"}{" "}
          {provider && <span className="text-xs text-zinc-400">(để trống nếu không đổi)</span>}
          <input
            type="password"
            value={values.secretAccessKey}
            onChange={(e) => set("secretAccessKey", e.target.value)}
            required={!provider}
            className={inputClass}
          />
        </label>
      </div>
      {values.type === "MAILJET" && (
        <p className="text-xs text-zinc-400">
          Lấy API Key/Secret Key tại dashboard Mailjet (Account Settings → REST API). Hệ thống gửi
          qua SMTP relay của Mailjet (in-v3.mailjet.com) — dùng chung cho email xác minh tài khoản và
          đặt lại mật khẩu.
        </p>
      )}
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input type="checkbox" checked={values.isDefault} onChange={(e) => set("isDefault", e.target.checked)} />
        Đặt làm provider mặc định
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Huỷ
        </button>
      </div>
    </form>
  );
}
