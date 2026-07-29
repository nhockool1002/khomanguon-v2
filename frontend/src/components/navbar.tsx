"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { LogoMark } from "./logo-mark";

export function Navbar() {
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
    <header className="flex items-center justify-between bg-[#16181d] px-6 py-3 text-white">
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
    </header>
  );
}
