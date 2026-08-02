"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/quan-tri/bai-viet", label: "Tất cả bài viết", icon: "📄", match: "exact-prefix" as const },
  { href: "/quan-tri/bai-viet/moi", label: "Viết bài mới", icon: "＋", match: "exact" as const },
  { href: "/quan-tri/danh-muc", label: "Danh mục", icon: "🗂", match: "prefix" as const },
  { href: "/quan-tri/menu", label: "Menu", icon: "☰", match: "prefix" as const },
  { href: "/quan-tri/widget", label: "Widget", icon: "🧩", match: "prefix" as const },
  { href: "/quan-tri/nguoi-dung", label: "Quản lý User", icon: "👤", match: "prefix" as const },
  { href: "/quan-tri/giao-dich", label: "Giao dịch ($P)", icon: "💰", match: "prefix" as const },
  { href: "/quan-tri/binh-luan", label: "Quản lý bình luận", icon: "💬", match: "prefix" as const },
  { href: "/quan-tri/vai-tro", label: "Phân quyền", icon: "🛡", match: "prefix" as const },
  { href: "/quan-tri/cai-dat/storage", label: "Cài đặt Storage", icon: "☁️", match: "prefix" as const },
  { href: "/quan-tri/tep-cloud", label: "Quản lý File Cloud", icon: "🗃️", match: "prefix" as const },
  { href: "/quan-tri/cai-dat/sepay", label: "Cài đặt SePay", icon: "💳", match: "prefix" as const },
];

// Menu quản trị nằm bên trái, kiểu WordPress admin — thay cho việc rải link trên navbar.
export function AdminSidebar() {
  const pathname = usePathname() ?? "";

  function isActive(item: (typeof NAV_ITEMS)[number]): boolean {
    if (item.match === "exact") return pathname === item.href;
    if (item.match === "prefix") return pathname.startsWith(item.href);
    // "exact-prefix": danh sách bài viết chỉ active khi KHÔNG phải trang "Viết bài mới"
    // (cả hai đều bắt đầu bằng /quan-tri/bai-viet).
    return pathname.startsWith(item.href) && pathname !== "/quan-tri/bai-viet/moi";
  }

  return (
    <aside className="flex w-56 flex-none flex-col gap-1 bg-[#16181d] px-3 py-6">
      <p className="px-3 pb-3 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
        Quản trị
      </p>

      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
            isActive(item)
              ? "bg-[#1d3557] text-white"
              : "text-zinc-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          <span aria-hidden>{item.icon}</span>
          {item.label}
        </Link>
      ))}

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
