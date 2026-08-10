"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { AuthCard, ErrorBanner, SuccessBanner } from "@/components/ui";

// Cùng pattern xac-minh-email/page.tsx — đọc id/token từ query (link trong email digest), POST lên
// backend để verify + huỷ đăng ký.
function UnsubscribeContent() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const token = params.get("token") ?? "";
  const [error, setError] = useState<string | null>(
    id && token ? null : "Link huỷ đăng ký không hợp lệ — thiếu thông tin xác nhận.",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(Boolean(id && token));

  useEffect(() => {
    if (!id || !token) return;
    apiFetch<{ ok: true }>("/newsletter/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ id, token }),
    })
      .then(() => setMessage("Đã huỷ đăng ký nhận bản tin thành công."))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"))
      .finally(() => setChecking(false));
  }, [id, token]);

  return (
    <AuthCard title="Huỷ đăng ký bản tin">
      {checking ? (
        <p className="text-sm text-zinc-500">Đang xử lý...</p>
      ) : (
        <div className="flex flex-col gap-4">
          <ErrorBanner message={error} />
          <SuccessBanner message={message} />
          <Link href="/" className="text-center text-sm text-[#1d3557] hover:underline">
            Về trang chủ
          </Link>
        </div>
      )}
    </AuthCard>
  );
}

export default function UnsubscribeNewsletterPage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeContent />
    </Suspense>
  );
}
