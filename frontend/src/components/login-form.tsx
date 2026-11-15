"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { ErrorBanner, FormField, SubmitButton } from "@/components/ui";
import { RecaptchaWidget } from "@/components/recaptcha-widget";

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const profile = await login(email, password, recaptchaToken);
      // Admin đăng nhập trên tab đã lỡ tải quảng cáo lúc còn là khách ẩn danh (ads-scripts.tsx chỉ
      // biết ẩn quảng cáo SAU khi user context cập nhật — script của Monetag đã gắn listener vào
      // document từ trước, gỡ thẻ <script> không huỷ được listener đó) — hard reload bằng
      // window.location thay vì router.push để nạp lại toàn bộ trang, đảm bảo không còn quảng cáo
      // nào sót lại trong phiên làm việc của Admin.
      if (profile.permissionKeys?.includes(PERMISSIONS.SETTINGS_GENERAL)) {
        window.location.href = "/";
      } else {
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra, thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <ErrorBanner message={error} />
      <FormField
        label="Email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <FormField
        label="Mật khẩu"
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="flex items-center justify-between text-sm">
        <Link href="/quen-mat-khau" className="text-[#1d3557] hover:underline">
          Quên mật khẩu?
        </Link>
      </div>
      <RecaptchaWidget onVerify={setRecaptchaToken} />
      <SubmitButton type="submit" loading={loading}>
        Đăng nhập
      </SubmitButton>
      <p className="text-center text-sm text-zinc-500">
        Chưa có tài khoản?{" "}
        <Link href="/dang-ky" className="text-[#1d3557] hover:underline">
          Đăng ký
        </Link>
      </p>
    </form>
  );
}
