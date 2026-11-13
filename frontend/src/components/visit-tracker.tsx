"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { API_URL, getAccessToken } from "@/lib/api";

// Bắn 1 "lượt truy cập" mỗi khi đổi route (toàn site, không chỉ trang bài viết — khác
// post-view-tracker.tsx vốn chỉ gắn ở trang chi tiết bài viết) cho Dashboard thống kê
// (/admin/dashboard). Dùng fetch thô thay vì apiFetch để không hiện GlobalLoadingBar cho 1 beacon
// chạy nền và không kích hoạt luồng refresh token nếu lỗi (xem lib/api.ts) — luôn fire-and-forget,
// không ảnh hưởng trải nghiệm chuyển trang. Backend tự lọc bot + dedup phiên 30 phút (xem
// analytics.controller.ts), bỏ qua /admin ở đây chỉ để đỡ tốn 1 request vô ích.
export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const token = getAccessToken();
    fetch(`${API_URL}/analytics/track`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ path: pathname, referrer: document.referrer || undefined }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
