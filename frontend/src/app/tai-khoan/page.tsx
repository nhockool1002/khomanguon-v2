"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { ErrorBanner, FormField, SubmitButton, SuccessBanner } from "@/components/ui";
import { RoleBadge } from "@/components/role-badge";

type Tab = "thong-tin" | "bao-mat";

export default function AccountPage() {
  const { user, loading, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("thong-tin");

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="flex-1 px-6 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-xl font-semibold text-zinc-900">Tài khoản của tôi</h1>

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

  useEffect(() => {
    apiFetch<Profile>("/users/me").then((p) => {
      setProfile(p);
      setDisplayName(p.displayName);
      setBio(p.bio ?? "");
    });
  }, []);

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
        <RoleBadge roleSlugs={profile.roles} />
      </div>

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

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <FormField label="Email" value={profile.email} disabled readOnly />
        <FormField
          label="Tên hiển thị"
          required
          minLength={2}
          maxLength={50}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
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
