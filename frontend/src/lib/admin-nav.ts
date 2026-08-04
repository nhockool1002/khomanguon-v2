import {
  ArrowLeft,
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
import { PERMISSIONS, type PermissionKey } from "./permissions";

export type MatchMode = "exact" | "prefix" | "exact-prefix";

export interface NavLeaf {
  href: string;
  label: string;
  icon: LucideIcon;
  match: MatchMode;
  // Quyền bắt buộc để thấy mục này VÀ vào được trang tương ứng — khớp đúng @Permissions() ở
  // backend cho endpoint chính của trang đó (xem comment từng dòng), không đoán/nới lỏng hơn.
  permission: PermissionKey;
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  // Nhóm không có trang riêng (vd "Cài Đặt") thì để trống — bấm chỉ đóng/mở.
  href?: string;
  match?: MatchMode;
  // Quyền cho chính link của group (khi có href) — bắt buộc phải có cùng href để có ý nghĩa.
  permission?: PermissionKey;
  children: NavLeaf[];
}

export type NavEntry = ({ kind: "leaf" } & NavLeaf) | ({ kind: "group" } & NavGroup);

// "Quản lý bài viết" vừa là link (danh sách bài viết) vừa có menu con "Danh mục" — bỏ hẳn mục
// "Viết bài mới" riêng vì trang Quản lý bài viết đã có nút tạo bài mới ngay trên đầu trang.
//
// Nguồn sự thật duy nhất cho việc "chức năng nào ẩn/hiện với user nào" — dùng chung bởi
// components/admin-sidebar.tsx (lọc menu) và từng trang /quan-tri/* (chặn truy cập URL trực
// tiếp, xem components/forbidden-page.tsx) để 2 nơi không bao giờ lệch nhau.
export const ADMIN_NAV: NavEntry[] = [
  {
    kind: "group",
    label: "Quản lý bài viết",
    icon: FileText,
    href: "/quan-tri/bai-viet",
    match: "exact-prefix",
    // Khớp @Permissions(PERMISSIONS.POST_CREATE) trên GET /posts/admin/list và /posts/admin/:id.
    permission: PERMISSIONS.POST_CREATE,
    children: [
      {
        href: "/quan-tri/danh-muc",
        label: "Danh mục",
        icon: FolderTree,
        match: "prefix",
        // Chưa có quyền category.manage riêng — categories.controller.ts tái dùng POST_PUBLISH.
        permission: PERMISSIONS.POST_PUBLISH,
      },
    ],
  },
  {
    kind: "leaf",
    href: "/quan-tri/thu-vien-media",
    label: "Thư viện Media",
    icon: ImageIcon,
    match: "prefix",
    permission: PERMISSIONS.MEDIA_MANAGE,
  },
  {
    kind: "leaf",
    href: "/quan-tri/binh-luan",
    label: "Quản lý bình luận",
    icon: MessageSquare,
    match: "prefix",
    permission: PERMISSIONS.COMMENT_MODERATE,
  },
  {
    kind: "group",
    label: "Quản lý Giao diện",
    icon: LayoutTemplate,
    children: [
      {
        href: "/quan-tri/widget",
        label: "Quản lý Widget",
        icon: LayoutGrid,
        match: "prefix",
        permission: PERMISSIONS.WIDGET_MANAGE,
      },
      {
        href: "/quan-tri/menu",
        label: "Quản lý Menu",
        icon: MenuIcon,
        match: "prefix",
        permission: PERMISSIONS.MENU_MANAGE,
      },
    ],
  },
  {
    kind: "leaf",
    href: "/quan-tri/giao-dich",
    label: "Quản lý Giao Dịch",
    icon: Wallet,
    match: "prefix",
    permission: PERMISSIONS.WALLET_VIEW_ANY,
  },
  {
    kind: "group",
    label: "Quản lý User & Role",
    icon: Users,
    children: [
      {
        href: "/quan-tri/nguoi-dung",
        label: "Quản lý User",
        icon: User,
        match: "prefix",
        permission: PERMISSIONS.USER_MANAGE,
      },
      {
        href: "/quan-tri/vai-tro",
        label: "Quản lý Permission",
        icon: ShieldCheck,
        match: "prefix",
        permission: PERMISSIONS.ROLE_MANAGE,
      },
    ],
  },
  {
    kind: "leaf",
    href: "/quan-tri/tep-cloud",
    label: "Quản lý File Cloud",
    icon: Cloud,
    match: "prefix",
    permission: PERMISSIONS.DOWNLOAD_MANAGE_LINKS,
  },
  {
    kind: "group",
    label: "Cài Đặt",
    icon: Settings,
    children: [
      {
        href: "/quan-tri/cai-dat/storage",
        label: "Cài đặt Provider",
        icon: Server,
        match: "prefix",
        permission: PERMISSIONS.SETTINGS_STORAGE_KEYS,
      },
      {
        href: "/quan-tri/cai-dat/sepay",
        label: "Cài đặt SePay",
        icon: CreditCard,
        match: "prefix",
        permission: PERMISSIONS.SETTINGS_PAYMENT,
      },
      {
        href: "/quan-tri/cai-dat/email",
        label: "Cài đặt Email",
        icon: Mail,
        match: "prefix",
        permission: PERMISSIONS.SETTINGS_MAIL,
      },
      {
        href: "/quan-tri/cai-dat/chung",
        label: "Cài đặt chung",
        icon: SlidersHorizontal,
        match: "prefix",
        permission: PERMISSIONS.SETTINGS_GENERAL,
      },
    ],
  },
];

// Icon "Về trang chủ" ở cuối sidebar — export riêng vì không phải mục điều hướng quản trị.
export const BACK_HOME_ICON = ArrowLeft;

function collectPermissions(entries: NavEntry[]): PermissionKey[] {
  return entries.flatMap((entry) =>
    entry.kind === "leaf"
      ? [entry.permission]
      : [...(entry.permission ? [entry.permission] : []), ...entry.children.map((c) => c.permission)],
  );
}

// Toàn bộ quyền có thể mở được ít nhất 1 trang quản trị — dùng để tính "user này có nên thấy nút
// Quản trị/vào được khu quản trị hay không" mà không cần liệt kê lại danh sách quyền lần 2 (nếu chỉ
// đơn giản là "permissionKeys.length > 0" thì Member thường (có comment.create/wallet.view.own/
// download.purchase) cũng bị tính nhầm là có quyền quản trị — đây là lỗi thật đã gặp).
const ADMIN_NAV_PERMISSIONS: Set<string> = new Set(collectPermissions(ADMIN_NAV));

export function hasAdminAccess(permissionKeys?: string[]): boolean {
  if (!permissionKeys?.length) return false;
  return permissionKeys.some((p) => ADMIN_NAV_PERMISSIONS.has(p));
}
