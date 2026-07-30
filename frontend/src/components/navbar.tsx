"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import type { Category } from "@/lib/types";
import { LogoMark } from "./logo-mark";

export function Navbar({ categories = [] }: { categories?: Category[] }) {
  const { user, loading, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="bg-[#16181d] text-white">
      <div className="flex items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size={30} />
          <span className="font-mono text-sm font-semibold tracking-tight">
            khomanguon
          </span>
        </Link>

        <nav className="flex items-center gap-3">
          {loading ? null : user ? (
            <>
              <Link
                href="/quan-tri/bai-viet"
                className="rounded-md px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10"
              >
                Quản lý bài viết
              </Link>
              <Link
                href="/tai-khoan"
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2b3f5c] font-mono text-xs uppercase">
                  {user.displayName.charAt(0)}
                </span>
                {user.displayName}
              </Link>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-50"
              >
                {loggingOut ? "Đang thoát..." : "Đăng xuất"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/dang-nhap"
                className="rounded-md px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10"
              >
                Đăng nhập
              </Link>
              <Link
                href="/dang-ky"
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
              >
                Đăng ký
              </Link>
            </>
          )}
        </nav>
      </div>

      {categories.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto border-t border-white/10 px-6 py-2">
          {categories
            .filter((c) => !c.parentId)
            .map((c) => (
              <Link
                key={c.id}
                href={`/danh-muc/${c.slug}`}
                className="whitespace-nowrap rounded-md px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                {c.name}
              </Link>
            ))}
        </div>
      )}
    </header>
  );
}
