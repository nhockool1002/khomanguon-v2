"use client";

import Link from "next/link";
import { useRoleBadges } from "@/context/role-badges-context";
import { fontVar } from "@/lib/fonts";

// Style (màu/đậm/nghiêng/font) do Admin cấu hình cho 1 role ở /quan-tri/vai-tro — mọi user thuộc
// role đó hiển thị tên theo đúng style này (không phải badge riêng, style áp thẳng lên tên).
// User thuộc nhiều role thì styleRoleSlug đã được backend resolve theo lựa chọn của chính họ
// (xem backend/src/roles/style-role.util.ts) — FE chỉ cần tra đúng 1 role tương ứng.
export function useRoleNameStyle(styleRoleSlug: string | null): React.CSSProperties {
  const badges = useRoleBadges();
  const role = styleRoleSlug ? badges.find((b) => b.slug === styleRoleSlug) : undefined;
  if (!role) return {};
  return {
    color: role.color ?? undefined,
    fontWeight: role.bold ? 700 : undefined,
    fontStyle: role.italic ? "italic" : undefined,
    fontFamily: fontVar(role.fontFamily),
  };
}

// userId (tuỳ chọn) — khi có thì bấm vào tên chuyển sang trang profile công khai (/nguoi-dung/[id]).
// Mọi nơi hiển thị tên user (byline bài viết, bình luận, member đã tải...) nên truyền userId vào
// đây để đồng bộ hành vi "bấm tên -> xem profile" thay vì tự viết Link riêng ở từng nơi.
export function StyledUserName({
  styleRoleSlug,
  userId,
  className,
  children,
}: {
  styleRoleSlug: string | null;
  userId?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const style = useRoleNameStyle(styleRoleSlug);
  if (userId) {
    return (
      <Link href={`/nguoi-dung/${userId}`} className={className} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <span className={className} style={style}>
      {children}
    </span>
  );
}
