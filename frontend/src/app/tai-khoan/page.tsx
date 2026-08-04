"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Trash2, Wallet as WalletIcon } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { hasAdminAccess } from "@/lib/admin-nav";
import { useWalletSocket } from "@/lib/socket";
import type { Profile, Wallet } from "@/lib/types";
import { ErrorBanner, FormField, SubmitButton, SuccessBanner } from "@/components/ui";
import { StyledUserName } from "@/components/styled-user-name";

type Tab = "thong-tin" | "bao-mat";

export default function AccountPage() {
  const { user, loading, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("thong-tin");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [cacheStatus, setCacheStatus] = useState<
    "idle" | "clearing" | "done" | "error"
  >("idle");

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<Wallet>("/wallet/me").then(setWallet).catch(() => setWallet(null));
  }, [user]);

  // Đẩy realtime khi SePay xác nhận nạp tiền — cập nhật chip số dư ngay trên trang này
  // (xem backend/src/realtime/wallet.gateway.ts).
  useWalletSocket(!!user, (payload) => {
    setWallet((prev) => (prev ? { ...prev, balance: payload.balance } : prev));
  });

  // Nút "Xoá cache" — chỉ hiện với user có quyền cache.manage (mặc định chỉ Admin, xem
  // backend/src/roles/permissions.constant.ts). Backend vẫn tự kiểm tra lại quyền này ở
  // PermissionsGuard nên việc ẩn/hiện ở đây chỉ là UX, không phải lớp bảo vệ duy nhất.
  async function handleClearCache() {
    setCacheStatus("clearing");
    try {
      await apiFetch("/admin/cache/clear", { method: "POST" });
      setCacheStatus("done");
    } catch {
      setCacheStatus("error");
    } finally {
      setTimeout(() => setCacheStatus("idle"), 2500);
    }
  }

  if (loading || !user) {
    return <div className="flex-1 px-6 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }

  // "Có quyền truy cập quản trị" = có ít nhất 1 quyền mở được 1 trang /quan-tri/* nào đó (lib/admin-nav.ts)
  // — KHÔNG phải cứ có permission bất kỳ, vì Member thường cũng có vài quyền tự phục vụ
  // (comment.create/wallet.view.own/download.purchase) nhưng không nên thấy nút này (lỗi thật đã gặp).
  const canAccessAdmin = hasAdminAccess(user.permissionKeys);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Tài khoản của tôi</h1>
        <div className="flex flex-wrap items-center gap-2">
          {wallet && (
            <Link
              href="/tai-khoan/vi"
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#ff5da2] to-[#ffcf3f] px-3 py-1 font-mono text-xs font-semibold text-white hover:opacity-90"
            >
              <WalletIcon size={14} strokeWidth={1.75} aria-hidden />
              {wallet.balance} $P
            </Link>
          )}
          {canAccessAdmin && (
            <Link
              href="/quan-tri/bai-viet"
              className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <ShieldCheck size={16} strokeWidth={1.75} aria-hidden />
              Quản trị
            </Link>
          )}
          {user.permissionKeys?.includes(PERMISSIONS.CACHE_MANAGE) && (
            <button
              onClick={handleClearCache}
              disabled={cacheStatus === "clearing"}
              title="Xoá cache trang (Redis + Next.js) trên toàn bộ website"
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
                cacheStatus === "error"
                  ? "border-red-300 text-red-600 hover:bg-red-50"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <Trash2 size={16} strokeWidth={1.75} aria-hidden />
              {cacheStatus === "clearing"
                ? "Đang xoá..."
                : cacheStatus === "done"
                  ? "Đã xoá ✓"
                  : cacheStatus === "error"
                    ? "Lỗi xoá cache"
                    : "Xoá cache"}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-zinc-200 font-mono text-sm">
        <TabButton active={tab === "thong-tin"} onClick={() => setTab("thong-tin")}>
          Thông tin
        </TabButton>
        <TabButton active={tab === "bao-mat"} onClick={() => setTab("bao-mat")}>
          Bảo mật
        </TabButton>
        <Link
          href="/tai-khoan/vi"
          className="border-b-2 border-transparent px-3 py-2 text-zinc-500 hover:text-zinc-700"
        >
          Ví &amp; Nạp tiền
        </Link>
      </div>

      {tab === "thong-tin" ? (
        <ProfileTab onSaved={refreshUser} />
      ) : (
        <SecurityTab onPasswordChanged={logout} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-3 py-2 ${
        active
          ? "border-[#1d3557] font-semibold text-[#1d3557]"
          : "border-transparent text-zinc-500 hover:text-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}

function ProfileTab({ onSaved }: { onSaved: () => Promise<void> }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [savingStyleRole, setSavingStyleRole] = useState(false);
  const [savingPopupPref, setSavingPopupPref] = useState(false);

  useEffect(() => {
    apiFetch<Profile>("/users/me").then((p) => {
      setProfile(p);
      setDisplayName(p.displayName);
      setBio(p.bio ?? "");
    });
  }, []);

  async function handleStyleRoleChange(roleSlug: string) {
    setSavingStyleRole(true);
    setError(null);
    try {
      const updated = await apiFetch<Profile>("/users/me/style-role", {
        method: "PATCH",
        body: JSON.stringify({ roleSlug }),
      });
      setProfile(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSavingStyleRole(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ displayName, bio }),
      });
      await onSaved();
      setMessage("Đã lưu thay đổi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePopup(next: boolean) {
    setSavingPopupPref(true);
    setError(null);
    try {
      const updated = await apiFetch<Profile>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ showPostPopup: next }),
      });
      setProfile(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSavingPopupPref(false);
    }
  }

  async function handleResendVerification() {
    setResending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch<{ message: string }>("/auth/resend-verification", {
        method: "POST",
      });
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setResending(false);
    }
  }

  if (!profile) return null;

  return (
    <div className="flex flex-col gap-4">
      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-zinc-500">Vai trò:</span>
        {profile.styleRoles.map((r) => (
          <span key={r.slug} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
            {r.name}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-zinc-500">Tên hiển thị của bạn:</span>
        <StyledUserName styleRoleSlug={profile.primaryRoleSlug} className="font-medium text-zinc-900">
          {profile.displayName}
        </StyledUserName>
      </div>

      {profile.styleRoles.length > 1 && (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          Hiển thị tên theo vai trò
          <select
            value={profile.primaryRoleSlug ?? ""}
            onChange={(e) => handleStyleRoleChange(e.target.value)}
            disabled={savingStyleRole}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557] disabled:opacity-50"
          >
            {profile.styleRoles.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {!profile.emailVerified && (
        <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Email chưa được xác minh.
          <button
            onClick={handleResendVerification}
            disabled={resending}
            className="font-medium underline disabled:opacity-50"
          >
            {resending ? "Đang gửi..." : "Gửi lại email xác minh"}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-zinc-800">Popup gợi ý bài viết</p>
          <p className="text-xs text-zinc-500">
            Thẻ bài viết ngẫu nhiên hiện ở góc màn hình khi lướt web — tắt nếu thấy phiền.
          </p>
        </div>
        <ToggleSwitch
          checked={profile.showPostPopup !== false}
          disabled={savingPopupPref}
          onChange={handleTogglePopup}
        />
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <FormField label="Email" value={profile.email} disabled readOnly />
        <FormField
          label="Tên hiển thị"
          required
          minLength={2}
          maxLength={50}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={!profile.canChangeDisplayName}
        />
        {!profile.canChangeDisplayName && (
          <p className="-mt-2 text-xs text-zinc-400">
            Bạn đã dùng hết lượt đổi tên hiển thị miễn phí (chỉ được đổi 1 lần) — liên hệ Admin/Super
            Moderator nếu cần đổi lại.
          </p>
        )}
        <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
          Giới thiệu bản thân
          <textarea
            value={bio}
            maxLength={280}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          />
        </label>
        <div>
          <SubmitButton type="submit" loading={saving}>
            Lưu thay đổi
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

function ToggleSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-[#1d3557]" : "bg-zinc-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function SecurityTab({ onPasswordChanged }: { onPasswordChanged: () => Promise<void> }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/users/me/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setMessage("Đổi mật khẩu thành công — đang đăng xuất để đăng nhập lại...");
      setTimeout(async () => {
        await onPasswordChanged();
        router.push("/dang-nhap");
      }, 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
      <ErrorBanner message={error} />
      <SuccessBanner message={message} />
      <FormField
        label="Mật khẩu hiện tại"
        type="password"
        required
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />
      <FormField
        label="Mật khẩu mới"
        type="password"
        required
        minLength={8}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <p className="text-xs text-zinc-500">
        Đổi mật khẩu sẽ đăng xuất khỏi tất cả thiết bị, kể cả phiên hiện tại.
      </p>
      <div>
        <SubmitButton type="submit" loading={saving}>
          Đổi mật khẩu
        </SubmitButton>
      </div>
    </form>
  );
}
