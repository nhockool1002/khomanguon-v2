"use client";

import { useEffect } from "react";
import { apiFetch } from "@/lib/api";

// Không render gì — chỉ bắn 1 request POST /posts/:id/view ngay khi trang bài viết tải xong.
// Trang chi tiết bài viết (page.tsx) là Server Component, gọi GET /posts/:slug từ SERVER Next.js
// (qua publicFetch, ISR) nên backend không thấy đúng IP/identity người xem thật — component client
// này mới là nơi backend nhận đúng request từ trình duyệt để chống F5 spam (xem PostViewTrackerService).
// dùng apiFetch (không phải fetch thô) để tự đính kèm access token nếu user đã đăng nhập — giúp
// backend đếm theo userId (chính xác hơn IP khi nhiều người chung mạng NAT).
export function PostViewTracker({ postId }: { postId: string }) {
  useEffect(() => {
    apiFetch(`/posts/${postId}/view`, { method: "POST" }).catch(() => {});
  }, [postId]);
  return null;
}
