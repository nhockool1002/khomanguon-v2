"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Trash2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { fetchPublicProfile } from "@/lib/public-api";
import { PERMISSIONS } from "@/lib/permissions";
import { hasAdminAccess } from "@/lib/admin-nav";
import type { Profile, PublicProfile } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { ErrorBanner, FormField, SubmitButton, SuccessBanner } from "@/components/ui";
import { StyledUserName } from "@/components/styled-user-name";
import { ProfileMessages } from "@/components/profile-messages";
import { WalletDashboard } from "@/components/wallet-dashboard";
import { ActivityTab } from "@/components/activity-tab";

type Tab = "ho-so" | "thong-tin" | "bao-mat" | "vi" | "hoat-dong";
const TABS: Tab[] = ["ho-so", "thong-tin", "bao-mat", "vi", "hoat-dong"];

// Trang gộp "Hồ sơ công khai" (/nguoi-dung/[id] cũ) + "Tài khoản của tôi" (/tai-khoan cũ) —
// người khác chỉ thấy tab Hồ sơ; các tab Thông tin/Bảo mật/Ví chỉ hiện khi profileId trùng chính
// user đang đăng nhập (/tai-khoan, /tai-khoan/vi giờ chỉ còn là trang redirect sang đây).
export function ProfilePage({
  profileId,
  initialProfile,
  initialTab,
}: {
  profileId: string;
  initialProfile: PublicProfile;
  initialTab?: string;
}) {
  const { user, loading } = useAuth();
  const isOwnProfile = !loading && user?.id === profileId;

  const [tab, setTab] = useState<Tab>(
    initialTab && TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "ho-so",
  );
  const [profile, setProfile] = useState(initialProfile);

  // URL/state đòi tab riêng tư (thong-tin/bao-mat/vi) nhưng đây không phải profile của chính mình
  // (hoặc auth chưa xác định xong) — suy ra ngay lúc render thay vì đồng bộ qua effect (tránh
  // cascading render), rơi về tab Hồ sơ để không render nhầm form của người khác.
  const effectiveTab: Tab = isOwnProfile ? tab : "ho-so";

  const reloadPublicProfile = useCallback(async () => {
    const next = await fetchPublicProfile(profileId);
    if (next) setProfile(next);
  }, [profileId]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      {isOwnProfile && (
        <div className="flex gap-1 border-b border-zinc-200 font-mono text-sm">
          <TabButton active={tab === "ho-so"} onClick={() => setTab("ho-so")}>
            Hồ sơ
          </TabButton>
          <TabButton active={tab === "thong-tin"} onClick={() => setTab("thong-tin")}>
            Thông tin
          </TabButton>
          <TabButton active={tab === "bao-mat"} onClick={() => setTab("bao-mat")}>
            Bảo mật
          </TabButton>
          <TabButton active={tab === "vi"} onClick={() => setTab("vi")}>
            Ví &amp; Nạp tiền
          </TabButton>
          <TabButton active={tab === "hoat-dong"} onClick={() => setTab("hoat-dong")}>
            Hoạt động
          </TabButton>
        </div>
      )}

      {effectiveTab === "ho-so" && <ProfileTab profile={profile} profileId={profileId} />}
      {effectiveTab === "thong-tin" && <AccountInfoTab onSaved={reloadPublicProfile} />}
      {effectiveTab === "bao-mat" && <SecurityTab />}
      {effectiveTab === "vi" && <WalletDashboard />}
      {effectiveTab === "hoat-dong" && <ActivityTab />}
    </main>
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

// Nội dung công khai — ai cũng xem được, kể cả khách vãng lai chưa đăng nhập.
function ProfileTab({ profile, profileId }: { profile: PublicProfile; profileId: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-5">
        <span className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-full bg-[#2b3f5c] text-2xl uppercase text-white">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt={profile.displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            profile.displayName.charAt(0)
          )}
        </span>
        <div className="flex flex-col gap-1">
          <StyledUserName
            styleRoleSlug={profile.styleRoleSlug}
            className="text-xl font-semibold text-zinc-900"
          >
            {profile.displayName}
          </StyledUserName>
          {profile.title &&
            (profile.titleAllowHtml ? (
              <p
                className="text-sm text-zinc-600"
                dangerouslySetInnerHTML={{ __html: profile.title }}
              />
            ) : (
              <p className="text-sm text-zinc-600">{profile.title}</p>
            ))}
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>Thành viên từ {formatDate(profile.createdAt)}</span>
            {profile.roleNames.length > 0 && (
              <>
                <span>·</span>
                <span>{profile.roleNames.join(", ")}</span>
              </>
            )}
          </div>
          {profile.bio && <p className="mt-1 text-sm text-zinc-700">{profile.bio}</p>}
        </div>
      </div>

      <ProfileMessages profileUserId={profileId} />
    </div>
  );
}

function AccountInfoTab({ onSaved }: { onSaved: () => Promise<void> }) {
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [resending, setResending] = useState(false);
  const [savingStyleRole, setSavingStyleRole] = useState(false);
  const [savingPopupPref, setSavingPopupPref] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<"idle" | "clearing" | "done" | "error">("idle");

  const loadProfile = useCallback(() => {
    apiFetch<Profile>("/users/me").then((p) => {
      setProfile(p);
      setDisplayName(p.displayName);
      setBio(p.bio ?? "");
      setTitle(p.title ?? "");
    });
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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
      await Promise.all([refreshUser(), onSaved()]);
      loadProfile();
      setMessage("Đã lưu thay đổi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTitle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSavingTitle(true);
    try {
      const updated = await apiFetch<Profile>("/users/me/title", {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      setProfile(updated);
      await onSaved();
      setMessage("Đã lưu Title.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSavingTitle(false);
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

  // Nút "Xoá cache" — chỉ hiện với user có quyền cache.manage (mặc định chỉ Admin). Backend vẫn tự
  // kiểm tra lại quyền này ở PermissionsGuard nên việc ẩn/hiện ở đây chỉ là UX.
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

  if (!profile) return null;

  const canAccessAdmin = hasAdminAccess(profile.permissionKeys);
  const titleLeft = profile.userTitleConfig.maxLength - title.length;
  const titleCooldownText =
    !profile.canChangeTitle && profile.titleChangeAvailableAt
      ? `Bạn chỉ được đổi Title mỗi ${profile.userTitleConfig.cooldownDays} ngày — lần tới có thể đổi vào ${new Date(profile.titleChangeAvailableAt).toLocaleString("vi-VN")}.`
      : null;

  return (
    <div className="flex flex-col gap-4">
      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      <div className="flex flex-wrap items-center justify-end gap-2">
        {canAccessAdmin && (
          <Link
            href="/quan-tri/bai-viet"
            className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            <ShieldCheck size={16} strokeWidth={1.75} aria-hidden />
            Quản trị
          </Link>
        )}
        {profile.permissionKeys?.includes(PERMISSIONS.CACHE_MANAGE) && (
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

      <form onSubmit={handleSaveTitle} className="flex flex-col gap-2 rounded-md border border-zinc-200 p-4">
        <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
          Title (dòng chữ hiện dưới tên ở trang Hồ sơ)
          {profile.userTitleConfig.allowHtml ? (
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={2}
              disabled={!profile.canChangeTitle}
              className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557] disabled:bg-zinc-100"
            />
          ) : (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!profile.canChangeTitle}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557] disabled:bg-zinc-100"
            />
          )}
        </label>
        <p className="text-xs text-zinc-400">
          {profile.userTitleConfig.allowHtml && "Vai trò của bạn được dùng thẻ HTML trong Title. "}
          Tối đa {profile.userTitleConfig.maxLength} ký tự (còn {Math.max(titleLeft, 0)}).{" "}
          {profile.userTitleConfig.cooldownDays === null
            ? "Đổi tự do, không giới hạn."
            : `Đổi tối đa mỗi ${profile.userTitleConfig.cooldownDays} ngày.`}
        </p>
        {titleCooldownText && <p className="text-xs text-amber-600">{titleCooldownText}</p>}
        <div>
          <SubmitButton type="submit" loading={savingTitle} disabled={!profile.canChangeTitle}>
            Lưu Title
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

function SecurityTab() {
  const { logout } = useAuth();
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
        await logout();
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
