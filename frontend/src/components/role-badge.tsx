"use client";

import { useRoleBadges } from "@/context/role-badges-context";
import { fontVar } from "@/lib/fonts";

// Badge role style (title/color/bold/italic/font do Admin cấu hình ở /quan-tri/vai-tro) — dùng
// chung ở mọi nơi hiện tên user: bình luận, byline bài viết, trang quản lý User/Tài khoản.
export function RoleBadge({ roleSlugs }: { roleSlugs: string[] }) {
  const allBadges = useRoleBadges();
  const badges = roleSlugs
    .map((slug) => allBadges.find((b) => b.slug === slug))
    .filter((b) => b !== undefined);

  if (badges.length === 0) return null;

  return (
    <>
      {badges.map((b) => (
        <span
          key={b.slug}
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            color: b.color ?? undefined,
            backgroundColor: b.color ? `${b.color}1a` : undefined,
            fontWeight: b.bold ? 700 : undefined,
            fontStyle: b.italic ? "italic" : undefined,
            fontFamily: fontVar(b.fontFamily),
          }}
        >
          {b.title || b.name}
        </span>
      ))}
    </>
  );
}
