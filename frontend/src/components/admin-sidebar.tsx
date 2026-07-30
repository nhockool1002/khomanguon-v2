"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/quan-tri/bai-viet", label: "Tất cả bài viết", icon: "📄" },
  { href: "/quan-tri/bai-viet/moi", label: "Viết bài mới", icon: "＋" },
];

// Menu quản trị nằm bên trái, kiểu WordPress admin — thay cho việc rải link trên navbar.
export function AdminSidebar() {
  const pathname = usePathname();
  const isNewPost = pathname === "/quan-tri/bai-viet/moi";
  const isPostsSection = pathname?.startsWith("/quan-tri/bai-viet") ?? false;

  return (
    <aside className="flex w-56 flex-none flex-col gap-1 bg-[#16181d] px-3 py-6">
      <p className="px-3 pb-3 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
        Quản trị
      </p>

      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/quan-tri/bai-viet/moi" ? isNewPost : isPostsSection && !isNewPost;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-[#1d3557] text-white"
                : "text-zinc-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}

      <div className="mt-4 border-t border-white/10 pt-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <span aria-hidden>↩</span>
          Về trang chủ
        </Link>
      </div>
    </aside>
  );
}
