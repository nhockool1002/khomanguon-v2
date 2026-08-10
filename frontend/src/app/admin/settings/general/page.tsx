"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { uploadImage } from "@/lib/upload";
import { PERMISSIONS } from "@/lib/permissions";
import { FONT_OPTIONS, fontVar } from "@/lib/fonts";
import type {
  GeneralSettings,
  HeaderBackgroundAttachment,
  HeaderBackgroundSize,
  RateLimitSettings,
  RecaptchaAdminConfig,
} from "@/lib/types";
import { ErrorBanner, SuccessBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]";

const RATE_LIMIT_LABEL: Record<keyof Omit<RateLimitSettings, "enabled">, string> = {
  login: "Đăng nhập",
  register: "Đăng ký",
  forgotPassword: "Quên mật khẩu",
  resetPassword: "Đặt lại mật khẩu",
  search: "Tìm kiếm / duyệt bài viết",
  commentCreate: "Đăng bình luận",
  feedbackCreate: "Gửi góp ý",
  newsletterSubscribe: "Đăng ký nhận bản tin",
};

const DEFAULT_RATE_LIMITS: RateLimitSettings = {
  enabled: true,
  login: { windowSec: 600, max: 5 },
  register: { windowSec: 3600, max: 5 },
  forgotPassword: { windowSec: 900, max: 3 },
  resetPassword: { windowSec: 900, max: 5 },
  search: { windowSec: 60, max: 30 },
  commentCreate: { windowSec: 60, max: 10 },
  feedbackCreate: { windowSec: 3600, max: 5 },
  newsletterSubscribe: { windowSec: 3600, max: 5 },
};

export default function GeneralSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [postsPerPage, setPostsPerPage] = useState(9);
  const [siteTitle, setSiteTitle] = useState("");
  const [headerTitle, setHeaderTitle] = useState("");
  const [headerSlogan, setHeaderSlogan] = useState("");
  const [headerBackgroundColor, setHeaderBackgroundColor] = useState("#1d3557");
  const [headerBackgroundImageUrl, setHeaderBackgroundImageUrl] = useState<string | null>(null);
  const [headerBackgroundSize, setHeaderBackgroundSize] = useState<HeaderBackgroundSize>("cover");
  const [headerBackgroundAttachment, setHeaderBackgroundAttachment] =
    useState<HeaderBackgroundAttachment>("scroll");
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);
  const [headerMinHeight, setHeaderMinHeight] = useState(260);
  const [headerTitleColor, setHeaderTitleColor] = useState("#c7d2e0");
  const [headerTitleFontFamily, setHeaderTitleFontFamily] = useState<string | null>(null);
  const [headerTitleBold, setHeaderTitleBold] = useState(false);
  const [headerSloganColor, setHeaderSloganColor] = useState("#ffffff");
  const [headerSloganFontFamily, setHeaderSloganFontFamily] = useState<string | null>(null);
  const [headerSloganBold, setHeaderSloganBold] = useState(true);
  const [headerSloganItalic, setHeaderSloganItalic] = useState(false);
  const [footerText, setFooterText] = useState("");
  const [rateLimits, setRateLimits] = useState<RateLimitSettings>(DEFAULT_RATE_LIMITS);

  const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState("");
  const [recaptchaSecretKey, setRecaptchaSecretKey] = useState("");
  const [recaptchaHasSecretKey, setRecaptchaHasSecretKey] = useState(false);
  const [savingRecaptcha, setSavingRecaptcha] = useState(false);
  const [recaptchaMessage, setRecaptchaMessage] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<GeneralSettings>("/settings/general")
      .then((res) => {
        setPostsPerPage(res.postsPerPage);
        setSiteTitle(res.siteTitle);
        setHeaderTitle(res.headerTitle);
        setHeaderSlogan(res.headerSlogan);
        setHeaderBackgroundColor(res.headerBackgroundColor);
        setHeaderBackgroundImageUrl(res.headerBackgroundImageUrl);
        setHeaderBackgroundSize(res.headerBackgroundSize);
        setHeaderBackgroundAttachment(res.headerBackgroundAttachment);
        setPosX(res.headerBackgroundPositionX);
        setPosY(res.headerBackgroundPositionY);
        setHeaderMinHeight(res.headerMinHeight);
        setHeaderTitleColor(res.headerTitleColor);
        setHeaderTitleFontFamily(res.headerTitleFontFamily);
        setHeaderTitleBold(res.headerTitleBold);
        setHeaderSloganColor(res.headerSloganColor);
        setHeaderSloganFontFamily(res.headerSloganFontFamily);
        setHeaderSloganBold(res.headerSloganBold);
        setHeaderSloganItalic(res.headerSloganItalic);
        setFooterText(res.footerText);
        setRateLimits(res.rateLimits);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    apiFetch<RecaptchaAdminConfig>("/recaptcha/admin-config")
      .then((res) => {
        setRecaptchaEnabled(res.enabled);
        setRecaptchaSiteKey(res.siteKey);
        setRecaptchaHasSecretKey(res.hasSecretKey);
      })
      .catch(() => {});
  }, [user]);

  async function handleSaveRecaptcha() {
    setError(null);
    setRecaptchaMessage(null);
    setSavingRecaptcha(true);
    try {
      const res = await apiFetch<RecaptchaAdminConfig>("/recaptcha/admin-config", {
        method: "PUT",
        body: JSON.stringify({
          enabled: recaptchaEnabled,
          siteKey: recaptchaSiteKey,
          secretKey: recaptchaSecretKey || undefined,
        }),
      });
      setRecaptchaHasSecretKey(res.hasSecretKey);
      setRecaptchaSecretKey("");
      setRecaptchaMessage("Đã lưu cấu hình reCAPTCHA.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSavingRecaptcha(false);
    }
  }

  async function handleSave() {
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await apiFetch<GeneralSettings>("/settings/general", {
        method: "PUT",
        body: JSON.stringify({
          postsPerPage,
          siteTitle,
          headerTitle,
          headerSlogan,
          headerBackgroundColor,
          headerBackgroundImageUrl,
          headerBackgroundSize,
          headerBackgroundAttachment,
          headerBackgroundPositionX: posX,
          headerBackgroundPositionY: posY,
          headerMinHeight,
          headerTitleColor,
          headerTitleFontFamily,
          headerTitleBold,
          headerSloganColor,
          headerSloganFontFamily,
          headerSloganBold,
          headerSloganItalic,
          footerText,
          rateLimits,
        }),
      });
      setMessage("Đã lưu cấu hình chung.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadBackground(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setHeaderBackgroundImageUrl(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tải ảnh thất bại");
    } finally {
      setUploading(false);
    }
  }

  // Kéo chuột/chạm trong khung xem trước để chọn background-position tuỳ ý (tính theo % để không
  // phụ thuộc kích thước ảnh gốc) — Pointer Events gộp chung mouse + touch, không cần 2 bộ handler.
  function updatePositionFromEvent(e: { clientX: number; clientY: number }) {
    const el = previewRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 0), 100);
    const y = Math.min(Math.max(((e.clientY - rect.top) / rect.height) * 100, 0), 100);
    setPosX(Math.round(x));
    setPosY(Math.round(y));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updatePositionFromEvent(e);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    updatePositionFromEvent(e);
  }

  function handlePointerUp() {
    dragging.current = false;
  }

  const previewStyle: React.CSSProperties = headerBackgroundImageUrl
    ? {
        backgroundColor: headerBackgroundColor,
        backgroundImage: `url(${headerBackgroundImageUrl})`,
        backgroundSize: headerBackgroundSize,
        backgroundPosition: `${posX}% ${posY}%`,
        backgroundRepeat: "no-repeat",
      }
    : { backgroundColor: headerBackgroundColor };

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.SETTINGS_GENERAL)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Cài đặt chung</h1>
      <p className="text-sm text-zinc-500">
        Cấu hình chung cho toàn site: số bài viết/trang ở trang chủ, tiêu đề/slogan và nền của khối
        banner đầu trang chủ.
      </p>

      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Chung</p>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Tiêu đề website (thẻ &lt;title&gt; trình duyệt/SEO)
          <input
            value={siteTitle}
            onChange={(e) => setSiteTitle(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Trang chủ</p>
        <label className="flex max-w-xs flex-col gap-1 text-sm text-zinc-700">
          Số bài viết / trang
          <input
            type="number"
            min={1}
            max={50}
            value={postsPerPage}
            onChange={(e) => setPostsPerPage(Number(e.target.value) || 1)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Banner đầu trang</p>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Tiêu đề nhỏ (kicker)
          <input
            value={headerTitle}
            onChange={(e) => setHeaderTitle(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Slogan
          <textarea
            value={headerSlogan}
            onChange={(e) => setHeaderSlogan(e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Màu nền
            <input
              type="color"
              value={headerBackgroundColor}
              onChange={(e) => setHeaderBackgroundColor(e.target.value)}
              className="h-10 w-full rounded-md border border-zinc-300"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Ảnh nền (tuỳ chọn — để trống thì dùng màu nền)
            <input
              type="file"
              accept="image/*"
              onChange={handleUploadBackground}
              disabled={uploading}
              className="text-sm"
            />
          </label>
        </div>

        <label className="flex max-w-xs flex-col gap-1 text-sm text-zinc-700">
          Chiều cao tối thiểu (px)
          <input
            type="number"
            min={120}
            max={600}
            value={headerMinHeight}
            onChange={(e) => setHeaderMinHeight(Number(e.target.value) || 120)}
            className={inputClass}
          />
        </label>

        <div className="flex flex-col gap-3 rounded-md bg-zinc-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Style tiêu đề nhỏ (kicker)
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              Màu
              <input
                type="color"
                value={headerTitleColor}
                onChange={(e) => setHeaderTitleColor(e.target.value)}
                className="h-9 w-14 rounded border border-zinc-300"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              Font
              <select
                value={headerTitleFontFamily ?? ""}
                onChange={(e) => setHeaderTitleFontFamily(e.target.value || null)}
                className="w-44 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
              >
                <option value="">Mặc định</option>
                {FONT_OPTIONS.map((f) => (
                  <option key={f.key} value={f.key} style={{ fontFamily: fontVar(f.key) }}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={headerTitleBold}
                onChange={(e) => setHeaderTitleBold(e.target.checked)}
              />
              Đậm
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-md bg-zinc-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Style slogan
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              Màu
              <input
                type="color"
                value={headerSloganColor}
                onChange={(e) => setHeaderSloganColor(e.target.value)}
                className="h-9 w-14 rounded border border-zinc-300"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              Font
              <select
                value={headerSloganFontFamily ?? ""}
                onChange={(e) => setHeaderSloganFontFamily(e.target.value || null)}
                className="w-44 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
              >
                <option value="">Mặc định</option>
                {FONT_OPTIONS.map((f) => (
                  <option key={f.key} value={f.key} style={{ fontFamily: fontVar(f.key) }}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={headerSloganBold}
                onChange={(e) => setHeaderSloganBold(e.target.checked)}
              />
              Đậm
            </label>
            <label className="flex items-center gap-1.5 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={headerSloganItalic}
                onChange={(e) => setHeaderSloganItalic(e.target.checked)}
              />
              Nghiêng
            </label>
          </div>
        </div>

        {headerBackgroundImageUrl && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              Kích thước ảnh (background-size)
              <select
                value={headerBackgroundSize}
                onChange={(e) => setHeaderBackgroundSize(e.target.value as HeaderBackgroundSize)}
                className={inputClass}
              >
                <option value="cover">Cover (lấp đầy)</option>
                <option value="contain">Contain (vừa khung)</option>
                <option value="auto">Auto (kích thước gốc)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              Cuộn theo trang (background-attachment)
              <select
                value={headerBackgroundAttachment}
                onChange={(e) =>
                  setHeaderBackgroundAttachment(e.target.value as HeaderBackgroundAttachment)
                }
                className={inputClass}
              >
                <option value="scroll">Cuộn cùng trang (scroll)</option>
                <option value="fixed">Cố định (fixed)</option>
              </select>
            </label>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-700">
            Xem trước —{" "}
            {headerBackgroundImageUrl
              ? "kéo chuột trong khung để chọn vị trí ảnh"
              : "chưa có ảnh, đang dùng màu nền"}
          </p>
          <div
            ref={previewRef}
            onPointerDown={headerBackgroundImageUrl ? handlePointerDown : undefined}
            onPointerMove={headerBackgroundImageUrl ? handlePointerMove : undefined}
            onPointerUp={handlePointerUp}
            className={`relative w-full overflow-hidden rounded-lg border border-zinc-300 text-white ${
              headerBackgroundImageUrl ? "cursor-move" : ""
            }`}
            style={{ ...previewStyle, minHeight: Math.min(headerMinHeight, 320) }}
          >
            <div className="px-6 py-6">
              <p
                className="font-mono text-xs uppercase tracking-widest"
                style={{
                  color: headerTitleColor,
                  fontFamily: fontVar(headerTitleFontFamily),
                  fontWeight: headerTitleBold ? 700 : undefined,
                }}
              >
                {headerTitle || "khomanguon.vn"}
              </p>
              <p
                className="mt-2 max-w-md text-lg drop-shadow"
                style={{
                  color: headerSloganColor,
                  fontFamily: fontVar(headerSloganFontFamily),
                  fontWeight: headerSloganBold ? 700 : undefined,
                  fontStyle: headerSloganItalic ? "italic" : undefined,
                }}
              >
                {headerSlogan}
              </p>
            </div>
            {headerBackgroundImageUrl && (
              <span
                className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#1d3557] shadow"
                style={{ left: `${posX}%`, top: `${posY}%` }}
              />
            )}
          </div>
          {headerBackgroundImageUrl && (
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span>
                Vị trí: {posX}% / {posY}%
              </span>
              <button
                type="button"
                onClick={() => setHeaderBackgroundImageUrl(null)}
                className="rounded px-2 py-1 font-medium text-red-600 hover:bg-zinc-100"
              >
                Gỡ ảnh nền
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Chân trang</p>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Text hiển thị ở footer toàn site
          <input
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Rate limit API công khai
          </p>
          <label className="flex items-center gap-2 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={rateLimits.enabled}
              onChange={(e) => setRateLimits((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
            Bật rate limit
          </label>
        </div>
        <p className="text-xs text-zinc-400">
          Số lượt tối đa cho mỗi IP trong 1 khoảng thời gian — chặn brute-force đăng nhập, spam đăng
          ký/bình luận, dò quét tìm kiếm hàng loạt.
        </p>
        {(Object.keys(RATE_LIMIT_LABEL) as (keyof typeof RATE_LIMIT_LABEL)[]).map((key) => (
          <div key={key} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-3">
            <span className="text-sm text-zinc-700 sm:col-span-1">{RATE_LIMIT_LABEL[key]}</span>
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              Số lượt tối đa
              <input
                type="number"
                min={1}
                value={rateLimits[key].max}
                onChange={(e) =>
                  setRateLimits((prev) => ({
                    ...prev,
                    [key]: { ...prev[key], max: Math.max(1, Number(e.target.value) || 1) },
                  }))
                }
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              Trong (giây)
              <input
                type="number"
                min={1}
                value={rateLimits[key].windowSec}
                onChange={(e) =>
                  setRateLimits((prev) => ({
                    ...prev,
                    [key]: { ...prev[key], windowSec: Math.max(1, Number(e.target.value) || 1) },
                  }))
                }
                className={inputClass}
              />
            </label>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            reCAPTCHA v2 (đăng ký / đăng nhập)
          </p>
          <label className="flex items-center gap-2 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={recaptchaEnabled}
              onChange={(e) => setRecaptchaEnabled(e.target.checked)}
            />
            Bật reCAPTCHA
          </label>
        </div>
        <p className="text-xs text-zinc-400">
          Lấy cặp key tại{" "}
          <a
            href="https://www.google.com/recaptcha/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#1d3557] hover:underline"
          >
            google.com/recaptcha/admin
          </a>{" "}
          (chọn loại &quot;reCAPTCHA v2 - Hộp kiểm&quot;).
        </p>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Site key
          <input
            value={recaptchaSiteKey}
            onChange={(e) => setRecaptchaSiteKey(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Secret key
          <input
            type="password"
            value={recaptchaSecretKey}
            onChange={(e) => setRecaptchaSecretKey(e.target.value)}
            placeholder={recaptchaHasSecretKey ? "•••••••• (để trống để giữ nguyên)" : "Chưa cấu hình"}
            className={inputClass}
          />
        </label>
        {recaptchaMessage && <p className="text-xs text-emerald-600">{recaptchaMessage}</p>}
        <button
          type="button"
          onClick={handleSaveRecaptcha}
          disabled={savingRecaptcha}
          className="w-fit rounded-md border border-[#1d3557] px-3 py-1.5 text-sm font-medium text-[#1d3557] hover:bg-[#1d3557]/5 disabled:opacity-50"
        >
          {savingRecaptcha ? "Đang lưu..." : "Lưu reCAPTCHA"}
        </button>
      </div>

      <p className="text-xs text-zinc-400">
        Google Analytics / Search Console đã chuyển sang trang{" "}
        <Link href="/admin/settings/storage" className="font-medium text-[#1d3557] hover:underline">
          Cài đặt Provider
        </Link>
        .
      </p>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || uploading}
        className="w-fit rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
      >
        {saving ? "Đang lưu..." : "Lưu cấu hình"}
      </button>
    </div>
  );
}
