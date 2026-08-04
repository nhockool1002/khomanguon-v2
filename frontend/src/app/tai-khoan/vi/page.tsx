"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

// /tai-khoan/vi đã gộp vào tab "Ví & Nạp tiền" của /nguoi-dung/[id] (xem components/profile-page.tsx)
// — giữ lại route này làm alias vì navbar (nút "Nạp $P") vẫn trỏ thẳng "/tai-khoan/vi".
export default function WalletRedirectPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? `/nguoi-dung/${user.id}?tab=vi` : "/dang-nhap");
  }, [loading, user, router]);

  return <div className="flex-1 px-6 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
}
