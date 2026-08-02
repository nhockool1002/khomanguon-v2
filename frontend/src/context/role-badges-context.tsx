"use client";

import { createContext, useContext } from "react";
import type { RoleBadgeInfo } from "@/lib/types";

const RoleBadgesContext = createContext<RoleBadgeInfo[]>([]);

// Fetch 1 lần ở layout.tsx (Server Component, giống fetchMenus) rồi truyền xuống đây — tránh mỗi
// component tự gọi /roles/badges riêng.
export function RoleBadgesProvider({
  badges,
  children,
}: {
  badges: RoleBadgeInfo[];
  children: React.ReactNode;
}) {
  return <RoleBadgesContext.Provider value={badges}>{children}</RoleBadgesContext.Provider>;
}

export function useRoleBadges(): RoleBadgeInfo[] {
  return useContext(RoleBadgesContext);
}
