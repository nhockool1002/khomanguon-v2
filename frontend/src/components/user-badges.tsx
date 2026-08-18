"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { UserBadge } from "@/lib/types";

// Kệ huy hiệu thành tích ở tab "Hồ sơ" — công khai (GET /users/:id/badges, không cần đăng nhập),
// cùng pattern fetch-on-mount với activity-tab.tsx nhưng đơn giản hơn (tối đa 6 huy hiệu, không
// phân trang). Ẩn hẳn (return null) nếu chưa có huy hiệu nào — tránh 1 khối trống gây rối trang hồ
// sơ của những tài khoản mới/ít hoạt động.
export function UserBadges({ userId }: { userId: string }) {
  const [items, setItems] = useState<UserBadge[] | null>(null);

  useEffect(() => {
    apiFetch<UserBadge[]>(`/users/${userId}/badges`)
      .then(setItems)
      .catch(() => setItems([]));
  }, [userId]);

  if (!items || items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ badge }) => (
        <span
          key={badge.slug}
          title={badge.description}
          className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700"
        >
          <span aria-hidden>{badge.icon}</span>
          {badge.name}
        </span>
      ))}
    </div>
  );
}
