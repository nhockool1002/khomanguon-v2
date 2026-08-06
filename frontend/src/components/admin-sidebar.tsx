"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { ADMIN_NAV, BACK_HOME_ICON, type MatchMode, type NavLeaf, type NavGroup } from "@/lib/admin-nav";

type FilteredNavEntry =
  | ({ kind: "leaf" } & NavLeaf)
  | ({ kind: "group"; ownLinkVisible: boolean } & NavGroup);

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

const rowToneClass = (active: boolean) =>
  active ? "bg-[#1d3557] text-white" : "text-zinc-300 hover:bg-white/10 hover:text-white";

const itemClass = (active: boolean) =>
  `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${rowToneClass(active)}`;

// Menu quản trị nằm bên trái, kiểu WordPress admin — thay cho việc rải link trên navbar. Mỗi mục
// chỉ hiện với user có đúng quyền tương ứng (lib/admin-nav.ts) — chức năng không có quyền thì ẩn
// hẳn khỏi menu, không phải cứ bấm vào rồi mới báo không có quyền.
export function AdminSidebar() {
  const pathname = usePathname() ?? "";
  const { user } = useAuth();
  const permissionKeys = useMemo(() => new Set(user?.permissionKeys ?? []), [user]);

  const nav = useMemo((): FilteredNavEntry[] => {
    return ADMIN_NAV.flatMap((entry): FilteredNavEntry[] => {
      if (entry.kind === "leaf") {
        return permissionKeys.has(entry.permission) ? [entry] : [];
      }
      const children = entry.children.filter((c) => permissionKeys.has(c.permission));
      const ownLinkVisible = !!entry.permission && permissionKeys.has(entry.permission);
      if (children.length === 0 && !ownLinkVisible) return [];
      return [{ ...entry, children, ownLinkVisible }];
    });
  }, [permissionKeys]);

  const activeGroupLabels = useMemo(
    () =>
      nav
        .filter((entry): entry is (typeof nav)[number] & { kind: "group" } => entry.kind === "group")
        .filter((group) => groupIsActive(pathname, group))
        .map((group) => group.label),
    [nav, pathname],
  );

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeGroupLabels));
  const [syncedPathname, setSyncedPathname] = useState(pathname);
  // Sidebar w-60 cố định ăn gần hết màn hình <768px — chuyển thành drawer off-canvas trên mobile,
  // đóng lại mỗi khi điều hướng sang trang khác.
  const [mobileOpen, setMobileOpen] = useState(false);

  // Tự mở nhóm đang active + tự đóng drawer mobile khi điều hướng sang, không tự đóng nhóm người
  // dùng đã mở tay — cập nhật ngay trong lúc render (theo khuyến nghị React thay vì setState trong
  // useEffect, tránh render thừa).
  if (pathname !== syncedPathname) {
    setSyncedPathname(pathname);
    if (mobileOpen) setMobileOpen(false);
    if (!activeGroupLabels.every((label) => expanded.has(label))) {
      setExpanded((prev) => {
        const next = new Set(prev);
        activeGroupLabels.forEach((label) => next.add(label));
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
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Mở menu quản trị"
        className="fixed left-3 top-3 z-30 flex items-center rounded-md bg-[#16181d] p-2 text-zinc-200 shadow-lg md:hidden"
      >
        <Menu size={20} strokeWidth={1.75} aria-hidden />
      </button>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          aria-hidden
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-none flex-col gap-1 overflow-y-auto bg-[#16181d] px-3 py-6 transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-3 pb-3">
          <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">Quản trị</p>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng menu quản trị"
            className="text-zinc-400 hover:text-white md:hidden"
          >
            <X size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        {nav.map((entry) => {
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
              {entry.href && entry.match && entry.ownLinkVisible ? (
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
            <BACK_HOME_ICON size={17} strokeWidth={1.75} aria-hidden />
            Về trang chủ
          </Link>
        </div>
      </aside>
    </>
  );
}
