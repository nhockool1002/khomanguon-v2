"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

// /tai-khoan đã gộp vào /nguoi-dung/[id] (xem components/profile-page.tsx) — chỉ còn giữ lại route
// này làm alias vì nhiều nơi (navbar, login-form, register-form...) đã trỏ tới "/tai-khoan" và
// không cần biết trước ID của chính mình. Mặc định vào thẳng tab "Thông tin" — trước đây /tai-khoan
// LÀ trang quản lý thông tin, không phải trang xem hồ sơ công khai.
export default function AccountRedirectPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? `/nguoi-dung/${user.id}?tab=thong-tin` : "/dang-nhap");
  }, [loading, user, router]);

  return <div className="flex-1 px-6 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
}
