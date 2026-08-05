"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRoleBadges } from "@/context/role-badges-context";
import { fontVar } from "@/lib/fonts";
import { fetchUserPreview } from "@/lib/public-api";
import { formatDate } from "@/lib/format";
import type { PublicProfile } from "@/lib/types";

// Cache theo userId ở mức module (không phải state riêng từng instance) — cùng 1 user thường xuất
// hiện nhiều nơi trên 1 trang (tác giả nhiều bài viết, nhiều bình luận...), hover lần đầu ở đâu thì
// những chỗ khác dùng lại luôn, không gọi lại API.
const previewCache = new Map<string, Promise<PublicProfile | null>>();

function loadPreview(userId: string): Promise<PublicProfile | null> {
  let cached = previewCache.get(userId);
  if (!cached) {
    cached = fetchUserPreview(userId).catch(() => null);
    previewCache.set(userId, cached);
  }
  return cached;
}

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
  const [preview, setPreview] = useState<PublicProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!userId) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    );
  }

  function show() {
    timerRef.current = setTimeout(() => {
      setVisible(true);
      if (!loaded) {
        loadPreview(userId!).then((p) => {
          setPreview(p);
          setLoaded(true);
        });
      }
    }, 350);
  }
  function hide() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }

  return (
    <span className="relative inline-block" onMouseEnter={show} onMouseLeave={hide}>
      <Link href={`/nguoi-dung/${userId}`} className={className} style={style}>
        {children}
      </Link>
      {visible && preview && <UserPreviewCard profile={preview} />}
    </span>
  );
}

function UserPreviewCard({ profile }: { profile: PublicProfile }) {
  const style = useRoleNameStyle(profile.styleRoleSlug);
  return (
    <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-lg">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-full bg-[#2b3f5c] text-sm uppercase text-white">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt={profile.displayName} className="h-full w-full object-cover" />
          ) : (
            profile.displayName.charAt(0)
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={style}>
            {profile.displayName}
          </p>
          <p className="text-xs text-zinc-400">Thành viên từ {formatDate(profile.createdAt)}</p>
        </div>
      </div>
      {profile.bio && <p className="mt-2 line-clamp-3 text-xs text-zinc-600">{profile.bio}</p>}
      {profile.roleNames.length > 0 && (
        <p className="mt-2 text-xs text-zinc-500">{profile.roleNames.join(", ")}</p>
      )}
    </div>
  );
}
