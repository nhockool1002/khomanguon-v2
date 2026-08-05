"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import { ErrorBanner, FormField, SubmitButton } from "@/components/ui";
import { RecaptchaWidget } from "@/components/recaptcha-widget";

export function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
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
      await register(email, password, displayName, recaptchaToken);
      router.push("/tai-khoan");
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
        label="Tên hiển thị"
        required
        minLength={2}
        maxLength={50}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
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
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <p className="text-xs text-zinc-500">Tối thiểu 8 ký tự.</p>
      <RecaptchaWidget onVerify={setRecaptchaToken} />
      <SubmitButton type="submit" loading={loading}>
        Tạo tài khoản
      </SubmitButton>
      <p className="text-center text-sm text-zinc-500">
        Đã có tài khoản?{" "}
        <Link href="/dang-nhap" className="text-[#1d3557] hover:underline">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
