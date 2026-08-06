"use client";

import Link from "next/link";
import { useState } from "react";
import { LogOut, Menu, Wallet as WalletIcon, X } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import type { MenuItem } from "@/lib/types";
import { LogoMark } from "./logo-mark";
import { NotificationBell } from "./notification-bell";

export function Navbar({ menus = [] }: { menus?: MenuItem[] }) {
  // Chỉ hiển thị mục gốc, công khai (roleSlugs rỗng) — lọc theo vai trò user cụ thể
  // cần AuthUser có roles (chưa có ở context hiện tại), để dành bản sau.
  const publicRootMenus = menus
    .filter((m) => !m.parentId && m.roleSlugs.length === 0)
    .sort((a, b) => a.order - b.order);
  const { user, loading, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  // Cụm hành động (chuông/Nạp $P/tên/đăng xuất) không đủ chỗ dưới ~640px — ẩn hẳn sau sm:flex,
  // gộp vào 1 panel dọc mở/đóng bằng nút hamburger thay vì để tràn/vỡ layout.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setMobileMenuOpen(false);
    }
  }

  return (
    <header className="bg-[#16181d] text-white">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
          <LogoMark size={30} />
          <span className="font-mono text-sm font-semibold tracking-tight">
            khomanguon
          </span>
        </Link>

        <nav className="hidden items-center gap-3 sm:flex">
          {loading ? null : user ? (
            <>
              <NotificationBell enabled={!!user} />
              <Link
                href="/tai-khoan/vi"
                className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#ff5da2] to-[#ffcf3f] px-3 py-1.5 text-sm font-semibold text-[#1d3557] hover:opacity-90"
              >
                <WalletIcon size={16} strokeWidth={1.75} aria-hidden />
                Nạp $P
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
                title="Đăng xuất"
                aria-label="Đăng xuất"
                className="flex items-center rounded-md px-2.5 py-1.5 text-zinc-300 hover:bg-white/10 disabled:opacity-50"
              >
                <LogOut size={18} strokeWidth={1.75} aria-hidden />
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

        {!loading && (
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={mobileMenuOpen}
            className="flex items-center rounded-md p-2 text-zinc-200 hover:bg-white/10 sm:hidden"
          >
            {mobileMenuOpen ? (
              <X size={20} strokeWidth={1.75} aria-hidden />
            ) : (
              <Menu size={20} strokeWidth={1.75} aria-hidden />
            )}
          </button>
        )}
      </div>

      {mobileMenuOpen && !loading && (
        <div className="flex flex-col gap-2 border-t border-white/10 px-4 py-3 sm:hidden">
          {user ? (
            <>
              <div className="flex items-center justify-between">
                <Link
                  href="/tai-khoan"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2b3f5c] font-mono text-xs uppercase">
                    {user.displayName.charAt(0)}
                  </span>
                  {user.displayName}
                </Link>
                <NotificationBell enabled={!!user} />
              </div>
              <Link
                href="/tai-khoan/vi"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-[#ff5da2] to-[#ffcf3f] px-3 py-2 text-sm font-semibold text-[#1d3557] hover:opacity-90"
              >
                <WalletIcon size={16} strokeWidth={1.75} aria-hidden />
                Nạp $P
              </Link>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-50"
              >
                <LogOut size={18} strokeWidth={1.75} aria-hidden />
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link
                href="/dang-nhap"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-center text-sm text-zinc-200 hover:bg-white/10"
              >
                Đăng nhập
              </Link>
              <Link
                href="/dang-ky"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md bg-white/10 px-3 py-2 text-center text-sm font-medium hover:bg-white/20"
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
      )}

      {publicRootMenus.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto border-t border-white/10 px-6 py-2">
          {publicRootMenus.map((m) => (
            <Link
              key={m.id}
              href={m.url}
              target={m.openInNewTab ? "_blank" : undefined}
              rel={m.openInNewTab ? "noopener noreferrer" : undefined}
              className="whitespace-nowrap rounded-md px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              {m.icon && <span aria-hidden>{m.icon} </span>}
              {m.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
