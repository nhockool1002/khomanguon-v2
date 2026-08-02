"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useNotificationSocket } from "@/lib/socket";
import { renderMentionText } from "@/lib/mentions";
import type { AppNotification } from "@/lib/types";

// Chuông thông báo @mention — badge số chưa đọc + dropdown, cập nhật realtime qua
// notification.gateway.ts (xem lib/socket.ts useNotificationSocket).
export function NotificationBell({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    apiFetch<{ count: number }>("/notifications/unread-count")
      .then((res) => setUnreadCount(res.count))
      .catch(() => {});
  }, [enabled]);

  useNotificationSocket<AppNotification>(enabled, (notif) => {
    setUnreadCount((c) => c + 1);
    setItems((prev) => (prev ? [notif, ...prev] : prev));
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && items === null) {
      try {
        const res = await apiFetch<{ items: AppNotification[]; total: number }>(
          "/notifications?limit=10",
        );
        setItems(res.items);
      } catch {
        setItems([]);
      }
    }
  }

  async function handleItemClick(notif: AppNotification) {
    if (!notif.isRead) {
      setUnreadCount((c) => Math.max(0, c - 1));
      setItems((prev) =>
        prev ? prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)) : prev,
      );
      apiFetch(`/notifications/${notif.id}/read`, { method: "PATCH" }).catch(() => {});
    }
    setOpen(false);
  }

  async function handleMarkAllRead() {
    setUnreadCount(0);
    setItems((prev) => (prev ? prev.map((n) => ({ ...n, isRead: true })) : prev));
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" });
    } catch {
      // bỏ qua — badge sẽ tự đúng lại ở lần load sau
    }
  }

  if (!enabled) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative rounded-md px-2.5 py-1.5 text-sm text-zinc-200 hover:bg-white/10"
        aria-label="Thông báo"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff5da2] px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 max-w-[90vw] rounded-md border border-zinc-200 bg-white text-zinc-900 shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
            <span className="text-sm font-semibold">Thông báo</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-[#1d3557] hover:underline"
              >
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items === null && (
              <p className="px-3 py-6 text-center text-sm text-zinc-400">Đang tải...</p>
            )}
            {items && items.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-zinc-400">Chưa có thông báo nào.</p>
            )}
            {items?.map((n) => (
              <Link
                key={n.id}
                href={n.post ? `/bai-viet/${n.post.slug}` : "#"}
                onClick={() => handleItemClick(n)}
                className={`flex flex-col gap-0.5 border-b border-zinc-50 px-3 py-2 text-sm last:border-0 hover:bg-zinc-50 ${
                  n.isRead ? "" : "bg-blue-50/60"
                }`}
              >
                <span className="text-zinc-700">
                  <span className="font-medium">{n.actor.displayName}</span> đã nhắc đến bạn
                  {n.post && <> trong bài viết &quot;{n.post.title}&quot;</>}
                </span>
                {n.comment && (
                  <span className="line-clamp-2 text-xs text-zinc-500">
                    {renderMentionText(n.comment.content)}
                  </span>
                )}
                <span className="text-[11px] text-zinc-400">
                  {new Date(n.createdAt).toLocaleString("vi-VN")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
