"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import {
  AuthCard,
  ErrorBanner,
  FormField,
  SubmitButton,
  SuccessBanner,
} from "@/components/ui";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      setMessage(res.message);
      setTimeout(() => router.push("/dang-nhap"), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra, thử lại sau");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthCard title="Đặt lại mật khẩu">
        <ErrorBanner message="Link đặt lại mật khẩu không hợp lệ — thiếu mã xác nhận." />
        <p className="mt-4 text-center text-sm">
          <Link href="/quen-mat-khau" className="text-[#1d3557] hover:underline">
            Yêu cầu link mới
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Đặt lại mật khẩu">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <ErrorBanner message={error} />
        <SuccessBanner message={message} />
        <FormField
          label="Mật khẩu mới"
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <SubmitButton type="submit" loading={loading}>
          Đặt lại mật khẩu
        </SubmitButton>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
