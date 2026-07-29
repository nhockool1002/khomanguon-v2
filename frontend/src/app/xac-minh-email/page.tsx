"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { AuthCard, ErrorBanner, SuccessBanner } from "@/components/ui";

function VerifyEmailContent() {
  const token = useSearchParams().get("token") ?? "";
  const [error, setError] = useState<string | null>(
    token ? null : "Link xác minh không hợp lệ — thiếu mã xác nhận.",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(Boolean(token));

  useEffect(() => {
    if (!token) return;
    apiFetch<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((res) => setMessage(res.message))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"),
      )
      .finally(() => setChecking(false));
  }, [token]);

  return (
    <AuthCard title="Xác minh email">
      {checking ? (
        <p className="text-sm text-zinc-500">Đang xác minh...</p>
      ) : (
        <div className="flex flex-col gap-4">
          <ErrorBanner message={error} />
          <SuccessBanner message={message} />
          <Link
            href="/tai-khoan"
            className="text-center text-sm text-[#1d3557] hover:underline"
          >
            Vào trang tài khoản
          </Link>
        </div>
      )}
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
