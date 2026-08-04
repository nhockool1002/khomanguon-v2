"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { MailTemplateConfig, MailTemplates } from "@/lib/types";
import { ErrorBanner, SuccessBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]";

const TEMPLATE_INFO = {
  topupSuccess: {
    title: "Khi user nạp tiền thành công",
    placeholders: ["displayName", "amountVnd", "paymentMethod", "transactionCode", "timestamp"],
  },
  downloadUnlock: {
    title: "Khi user tải file thành công",
    placeholders: ["displayName", "postTitle", "fileName", "priceP", "timestamp"],
  },
  passwordReset: {
    title: "Khi user yêu cầu đặt lại mật khẩu",
    placeholders: ["displayName", "resetUrl", "timestamp"],
  },
} as const;

type Kind = keyof typeof TEMPLATE_INFO;
type SectionKey = "notifyEmail" | Kind;

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`flex-none text-zinc-400 transition-transform ${open ? "" : "-rotate-90"}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function MailTemplatesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Accordion — chỉ 1 mục mở tại 1 thời điểm cho đỡ rối, mặc định đóng hết.
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [templates, setTemplates] = useState<Record<Kind, MailTemplateConfig>>({
    topupSuccess: { subject: "", html: "" },
    downloadUnlock: { subject: "", html: "" },
    passwordReset: { subject: "", html: "" },
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<Kind | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const reload = useCallback(() => {
    apiFetch<MailTemplates>("/mail/templates")
      .then((res) => {
        setNotifyEmail(res.notifyEmail);
        setTemplates({
          topupSuccess: res.topupSuccess,
          downloadUnlock: res.downloadUnlock,
          passwordReset: res.passwordReset,
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, []);

  useEffect(() => {
    if (!user) return;
    reload();
  }, [user, reload]);

  function updateTemplate(kind: Kind, field: "subject" | "html", value: string) {
    setTemplates((prev) => ({ ...prev, [kind]: { ...prev[kind], [field]: value } }));
  }

  async function handleSave() {
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await apiFetch<MailTemplates>("/mail/templates", {
        method: "PUT",
        body: JSON.stringify({ notifyEmail, ...templates }),
      });
      setMessage("Đã lưu template email.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestSend(kind: Kind) {
    setTestResult(null);
    setTesting(kind);
    try {
      const res = await apiFetch<{ success: boolean; message: string }>(
        `/mail/templates/test-send/${kind}`,
        { method: "POST" },
      );
      setTestResult(res);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof ApiError ? err.message : "Có lỗi xảy ra",
      });
    } finally {
      setTesting(null);
    }
  }

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.SETTINGS_MAIL)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4 px-8 py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Cài đặt Email thông báo</h1>
      <p className="text-sm text-zinc-500">
        Gửi email nội bộ cho Admin qua provider MailJet (cấu hình ở Cài đặt Storage) mỗi khi user
        nạp tiền hoặc tải file thành công. Email gửi đi dùng địa chỉ <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">MAIL_FROM</code> đã cấu hình trên server.
      </p>

      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      <div className="rounded-md border border-zinc-200">
        <button
          type="button"
          onClick={() => setOpenSection((s) => (s === "notifyEmail" ? null : "notifyEmail"))}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        >
          <span className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Email nhận thông báo
            </span>
            {openSection !== "notifyEmail" && (
              <span className="mt-0.5 text-xs text-zinc-400">
                {notifyEmail || "Chưa cấu hình — tắt gửi thông báo"}
              </span>
            )}
          </span>
          <ChevronIcon open={openSection === "notifyEmail"} />
        </button>
        {openSection === "notifyEmail" && (
          <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              Email nhận thông báo
              <input
                type="email"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="admin@khomanguon.org"
                className={inputClass}
              />
              <span className="text-xs text-zinc-400">
                Để trống thì tắt hẳn tính năng gửi thông báo (không gửi email nào).
              </span>
            </label>
          </div>
        )}
      </div>

      {(Object.keys(TEMPLATE_INFO) as Kind[]).map((kind) => {
        const isOpen = openSection === kind;
        return (
          <div key={kind} className="rounded-md border border-zinc-200">
            <button
              type="button"
              onClick={() => setOpenSection((s) => (s === kind ? null : kind))}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
            >
              <span className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {TEMPLATE_INFO[kind].title}
                </span>
                {!isOpen && (
                  <span className="mt-0.5 truncate text-xs text-zinc-400">
                    {templates[kind].subject || "Chưa có tiêu đề"}
                  </span>
                )}
              </span>
              <ChevronIcon open={isOpen} />
            </button>
            {isOpen && (
              <div className="flex flex-col gap-3 border-t border-zinc-100 px-4 pb-4 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-zinc-400">
                    Biến dùng được:{" "}
                    {TEMPLATE_INFO[kind].placeholders.map((p) => `{{${p}}}`).join(", ")}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTestSend(kind)}
                    disabled={testing === kind}
                    className="flex-none rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {testing === kind ? "Đang gửi..." : "Gửi thử"}
                  </button>
                </div>
                <label className="flex flex-col gap-1 text-sm text-zinc-700">
                  Tiêu đề
                  <input
                    value={templates[kind].subject}
                    onChange={(e) => updateTemplate(kind, "subject", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-zinc-700">
                  Nội dung (HTML)
                  <textarea
                    value={templates[kind].html}
                    onChange={(e) => updateTemplate(kind, "html", e.target.value)}
                    rows={8}
                    className={`${inputClass} font-mono text-xs`}
                  />
                </label>
              </div>
            )}
          </div>
        );
      })}

      {testResult && (
        <p className={`text-sm ${testResult.success ? "text-emerald-600" : "text-red-600"}`}>
          {testResult.message}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-fit rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
      >
        {saving ? "Đang lưu..." : "Lưu template"}
      </button>
    </div>
  );
}
