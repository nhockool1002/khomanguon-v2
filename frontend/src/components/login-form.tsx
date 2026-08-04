"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import { ErrorBanner, FormField, SubmitButton } from "@/components/ui";

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
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
