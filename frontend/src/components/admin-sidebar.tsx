"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  Cloud,
  CreditCard,
  FileText,
  FolderTree,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  Mail,
  MessageSquare,
  Menu as MenuIcon,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

type MatchMode = "exact" | "prefix" | "exact-prefix";

interface NavLeaf {
  href: string;
  label: string;
  icon: LucideIcon;
  match: MatchMode;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  // Nhóm không có trang riêng (vd "Cài Đặt") thì để trống — bấm chỉ đóng/mở.
  href?: string;
  match?: MatchMode;
  children: NavLeaf[];
}

type NavEntry = ({ kind: "leaf" } & NavLeaf) | ({ kind: "group" } & NavGroup);

// "Quản lý bài viết" vừa là link (danh sách bài viết) vừa có menu con "Danh mục" — bỏ hẳn mục
// "Viết bài mới" riêng vì trang Quản lý bài viết đã có nút tạo bài mới ngay trên đầu trang.
const NAV: NavEntry[] = [
  {
    kind: "group",
    label: "Quản lý bài viết",
    icon: FileText,
    href: "/quan-tri/bai-viet",
    match: "exact-prefix",
    children: [{ href: "/quan-tri/danh-muc", label: "Danh mục", icon: FolderTree, match: "prefix" }],
  },
  { kind: "leaf", href: "/quan-tri/thu-vien-media", label: "Thư viện Media", icon: ImageIcon, match: "prefix" },
  { kind: "leaf", href: "/quan-tri/binh-luan", label: "Quản lý bình luận", icon: MessageSquare, match: "prefix" },
  {
    kind: "group",
    label: "Quản lý Giao diện",
    icon: LayoutTemplate,
    children: [
      { href: "/quan-tri/widget", label: "Quản lý Widget", icon: LayoutGrid, match: "prefix" },
      { href: "/quan-tri/menu", label: "Quản lý Menu", icon: MenuIcon, match: "prefix" },
    ],
  },
  { kind: "leaf", href: "/quan-tri/giao-dich", label: "Quản lý Giao Dịch", icon: Wallet, match: "prefix" },
  {
    kind: "group",
    label: "Quản lý User & Role",
    icon: Users,
    children: [
      { href: "/quan-tri/nguoi-dung", label: "Quản lý User", icon: User, match: "prefix" },
      { href: "/quan-tri/vai-tro", label: "Quản Lý Phân Quyền", icon: ShieldCheck, match: "prefix" },
    ],
  },
  { kind: "leaf", href: "/quan-tri/tep-cloud", label: "Quản lý File Cloud", icon: Cloud, match: "prefix" },
  {
    kind: "group",
    label: "Cài Đặt",
    icon: Settings,
    children: [
      { href: "/quan-tri/cai-dat/storage", label: "Cài đặt Provider", icon: Server, match: "prefix" },
      { href: "/quan-tri/cai-dat/sepay", label: "Cài đặt SePay", icon: CreditCard, match: "prefix" },
      { href: "/quan-tri/cai-dat/email", label: "Cài đặt Email", icon: Mail, match: "prefix" },
      { href: "/quan-tri/cai-dat/chung", label: "Cài đặt chung", icon: SlidersHorizontal, match: "prefix" },
    ],
  },
];

function isActive(pathname: string, href: string, mode: MatchMode): boolean {
  if (mode === "exact") return pathname === href;
  if (mode === "prefix") return pathname.startsWith(href);
  // "exact-prefix": Quản lý bài viết chỉ active khi KHÔNG phải trang "Viết bài mới"
  // (cả hai đều bắt đầu bằng /quan-tri/bai-viet).
  return pathname.startsWith(href) && pathname !== "/quan-tri/bai-viet/moi";
}

function groupIsActive(pathname: string, group: NavGroup): boolean {
  if (group.href && group.match && isActive(pathname, group.href, group.match)) return true;
  return group.children.some((child) => isActive(pathname, child.href, child.match));
}

function activeGroupLabels(pathname: string): string[] {
  return NAV.filter((entry): entry is { kind: "group" } & NavGroup => entry.kind === "group")
    .filter((group) => groupIsActive(pathname, group))
    .map((group) => group.label);
}

const rowToneClass = (active: boolean) =>
  active ? "bg-[#1d3557] text-white" : "text-zinc-300 hover:bg-white/10 hover:text-white";

const itemClass = (active: boolean) =>
  `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${rowToneClass(active)}`;

// Menu quản trị nằm bên trái, kiểu WordPress admin — thay cho việc rải link trên navbar.
export function AdminSidebar() {
  const pathname = usePathname() ?? "";
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeGroupLabels(pathname)));
  const [syncedPathname, setSyncedPathname] = useState(pathname);

  // Tự mở nhóm đang active khi điều hướng sang, không tự đóng nhóm người dùng đã mở tay — cập nhật
  // ngay trong lúc render (theo khuyến nghị React thay vì setState trong useEffect, tránh render thừa).
  if (pathname !== syncedPathname) {
    setSyncedPathname(pathname);
    const active = activeGroupLabels(pathname);
    if (!active.every((label) => expanded.has(label))) {
      setExpanded((prev) => {
        const next = new Set(prev);
        active.forEach((label) => next.add(label));
        return next;
      });
    }
  }

  function toggleGroup(label: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <aside className="flex w-60 flex-none flex-col gap-1 overflow-y-auto bg-[#16181d] px-3 py-6">
      <p className="px-3 pb-3 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
        Quản trị
      </p>

      {NAV.map((entry) => {
        if (entry.kind === "leaf") {
          const Icon = entry.icon;
          return (
            <Link key={entry.href} href={entry.href} className={itemClass(isActive(pathname, entry.href, entry.match))}>
              <Icon size={17} strokeWidth={1.75} aria-hidden />
              {entry.label}
            </Link>
          );
        }

        const Icon = entry.icon;
        const isOpen = expanded.has(entry.label);
        const active = groupIsActive(pathname, entry);
        const headerContent = (
          <>
            <Icon size={17} strokeWidth={1.75} aria-hidden />
            <span className="flex-1 text-left">{entry.label}</span>
            <ChevronDown
              size={15}
              strokeWidth={1.75}
              aria-hidden
              className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </>
        );

        return (
          <div key={entry.label} className="flex flex-col">
            {entry.href && entry.match ? (
              <div className={`flex items-stretch rounded-md text-sm transition-colors ${rowToneClass(active)}`}>
                <Link href={entry.href} className="flex flex-1 items-center gap-2.5 px-3 py-2">
                  <Icon size={17} strokeWidth={1.75} aria-hidden />
                  {entry.label}
                </Link>
                <button
                  type="button"
                  onClick={() => toggleGroup(entry.label)}
                  aria-label={isOpen ? `Thu gọn ${entry.label}` : `Mở rộng ${entry.label}`}
                  className="flex items-center px-3 hover:text-white"
                >
                  <ChevronDown
                    size={15}
                    strokeWidth={1.75}
                    aria-hidden
                    className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => toggleGroup(entry.label)} className={itemClass(active)}>
                {headerContent}
              </button>
            )}

            {isOpen && (
              <div className="ml-4 mt-0.5 flex flex-col gap-1 border-l border-white/10 pl-2.5">
                {entry.children.map((child) => {
                  const ChildIcon = child.icon;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={itemClass(isActive(pathname, child.href, child.match))}
                    >
                      <ChildIcon size={15} strokeWidth={1.75} aria-hidden />
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="mt-4 border-t border-white/10 pt-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={17} strokeWidth={1.75} aria-hidden />
          Về trang chủ
        </Link>
      </div>
    </aside>
  );
}
