"use client";

import { useSyncExternalStore } from "react";
import { getServerSnapshot, getSnapshot, subscribe } from "@/lib/loading-store";

// Thanh loading mảnh cố định đầu trang — tự hiện ngay khi có bất kỳ apiFetch() nào đang chạy (xem
// lib/loading-store.ts, hook vào lib/api.ts) và tự ẩn khi xong. Không cần từng trang/nút tự khai
// báo state loading riêng — khắc phục cảm giác "bấm xong không thấy phản hồi gì" trong lúc chờ API
// trả lời. pointer-events-none để không chặn thao tác của user trong lúc đang hiện.
export function GlobalLoadingBar() {
  const isLoading = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!isLoading) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
      role="status"
      aria-label="Đang tải"
    >
      <div className="global-loading-bar-inner h-full w-full" />
    </div>
  );
}
