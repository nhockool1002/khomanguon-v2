"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import {
  AuthCard,
  ErrorBanner,
  FormField,
  SubmitButton,
  SuccessBanner,
} from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra, thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Quên mật khẩu">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <ErrorBanner message={error} />
        <SuccessBanner message={message} />
        <p className="text-sm text-zinc-500">
          Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu (hết hạn
          sau 15 phút).
        </p>
        <FormField
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <SubmitButton type="submit" loading={loading}>
          Gửi link đặt lại mật khẩu
        </SubmitButton>
        <p className="text-center text-sm text-zinc-500">
          <Link href="/dang-nhap" className="text-[#1d3557] hover:underline">
            Quay lại đăng nhập
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
