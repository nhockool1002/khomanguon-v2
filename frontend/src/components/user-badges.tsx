"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { UserBadge } from "@/lib/types";

// Bảng màu huy chương theo slug — mỗi huy hiệu 1 tông màu riêng để dễ phân biệt khi xếp cạnh nhau,
// càng "cao cấp" (khó đạt hơn) càng dùng tông ánh kim (vàng/tím) thay vì tông thường (cam/xanh lá).
const BADGE_COLORS: Record<
  string,
  { light: string; dark: string; ribbon: string; ribbonDark: string }
> = {
  "first-post": { light: "#f6ad55", dark: "#c05621", ribbon: "#e53e3e", ribbonDark: "#9b2c2c" },
  "prolific-writer": { light: "#63b3ed", dark: "#2b6cb0", ribbon: "#3182ce", ribbonDark: "#2c5282" },
  "first-comment": { light: "#68d391", dark: "#276749", ribbon: "#38a169", ribbonDark: "#22543d" },
  "century-commenter": { light: "#b794f4", dark: "#6b46c1", ribbon: "#805ad5", ribbonDark: "#553c9a" },
  veteran: { light: "#f6e05e", dark: "#b7791f", ribbon: "#d69e2e", ribbonDark: "#975a16" },
  supporter: { light: "#fbb6ce", dark: "#b83280", ribbon: "#d53f8c", ribbonDark: "#97266d" },
};
const DEFAULT_COLORS = { light: "#cbd5e0", dark: "#4a5568", ribbon: "#718096", ribbonDark: "#4a5568" };

// Huy chương vẽ tay bằng SVG (không dùng ảnh/icon set ngoài) — thân tròn ánh kim (radialGradient)
// + dải ruy băng chữ V phía dưới + 1 nét sáng viền trên mô phỏng ánh phản chiếu kim loại, emoji gốc
// của huy hiệu đặt giữa làm biểu tượng. id gradient gắn theo slug để nhiều huy chương cùng lúc trên
// trang không đụng id nhau (SVG <defs> dùng chung 1 DOM, id trùng sẽ khiến trình duyệt chỉ áp dụng
// gradient của phần tử xuất hiện đầu tiên cho mọi nơi tham chiếu).
function BadgeMedal({ slug, icon }: { slug: string; icon: string }) {
  const c = BADGE_COLORS[slug] ?? DEFAULT_COLORS;
  const gradId = `badge-grad-${slug}`;
  return (
    <svg
      width="56"
      height="66"
      viewBox="0 0 56 66"
      aria-hidden
      className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
    >
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={c.light} />
          <stop offset="100%" stopColor={c.dark} />
        </radialGradient>
      </defs>
      <path d="M20,30 L13,62 L28,53 Z" fill={c.ribbonDark} />
      <path d="M36,30 L43,62 L28,53 Z" fill={c.ribbon} />
      <circle cx="28" cy="26" r="23" fill={`url(#${gradId})`} stroke={c.dark} strokeWidth="1.5" />
      <circle cx="28" cy="26" r="18" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
      <path
        d="M12,21 A23,23 0 0,1 29,4"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <text x="28" y="33" fontSize="19" textAnchor="middle">
        {icon}
      </text>
    </svg>
  );
}

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
    <div className="flex flex-wrap gap-4">
      {items.map(({ badge }) => (
        <div
          key={badge.slug}
          title={badge.description}
          className="flex w-20 flex-col items-center gap-1 text-center"
        >
          <BadgeMedal slug={badge.slug} icon={badge.icon} />
          <span className="text-xs font-medium leading-tight text-zinc-700">{badge.name}</span>
        </div>
      ))}
    </div>
  );
}
