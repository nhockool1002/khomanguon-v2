// Danh mục quyền — khớp ma trận RBAC ở mục 06 docs/khomanguon-v2-spec.html.
// Module Post/Menu/Wallet/Download/Settings chưa tồn tại tới Phase 2-3, nhưng
// quyền được khai báo trước để không phải sửa lại RolePermission khi build module.
export const PERMISSIONS = {
  POST_CREATE: 'post.create',
  POST_EDIT_OWN: 'post.edit.own',
  POST_EDIT_ANY: 'post.edit.any',
  POST_PUBLISH: 'post.publish',
  POST_DELETE: 'post.delete',
  MENU_MANAGE: 'menu.manage',
  WIDGET_MANAGE: 'widget.manage',
  COMMENT_CREATE: 'comment.create',
  COMMENT_MODERATE: 'comment.moderate',
  USER_MANAGE: 'user.manage',
  USER_ASSIGN_ROLE: 'user.assign_role',
  ROLE_MANAGE: 'role.manage',
  WALLET_VIEW_OWN: 'wallet.view.own',
  WALLET_VIEW_ANY: 'wallet.view.any',
  WALLET_ADJUST: 'wallet.adjust',
  DOWNLOAD_MANAGE_LINKS: 'download.manage_links',
  DOWNLOAD_PURCHASE: 'download.purchase',
  SETTINGS_SEO: 'settings.seo',
  SETTINGS_STORAGE_KEYS: 'settings.storage_keys',
  SETTINGS_PAYMENT: 'settings.payment',
  SETTINGS_GENERAL: 'settings.general',
  MEDIA_MANAGE: 'media.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSION_KEYS: PermissionKey[] = Object.values(PERMISSIONS);

export const DEFAULT_ROLES = {
  ADMIN: { slug: 'admin', name: 'Admin' },
  SUPER_MODERATOR: { slug: 'super-moderator', name: 'Super Moderator' },
  MODERATOR: { slug: 'moderator', name: 'Moderator' },
  MEMBER: { slug: 'member', name: 'Member' },
} as const;

// Mặc định khi khởi tạo hệ thống — Admin chỉnh lại tự do qua trang Phân quyền (UC17)
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  [DEFAULT_ROLES.ADMIN.slug]: ALL_PERMISSION_KEYS,
  [DEFAULT_ROLES.SUPER_MODERATOR.slug]: [
    PERMISSIONS.POST_CREATE,
    PERMISSIONS.POST_EDIT_OWN,
    PERMISSIONS.POST_EDIT_ANY,
    PERMISSIONS.POST_PUBLISH,
    PERMISSIONS.POST_DELETE,
    PERMISSIONS.MENU_MANAGE,
    PERMISSIONS.WIDGET_MANAGE,
    PERMISSIONS.COMMENT_CREATE,
    PERMISSIONS.COMMENT_MODERATE,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.WALLET_VIEW_ANY,
    PERMISSIONS.DOWNLOAD_MANAGE_LINKS,
    PERMISSIONS.MEDIA_MANAGE,
  ],
  [DEFAULT_ROLES.MODERATOR.slug]: [
    PERMISSIONS.POST_CREATE,
    PERMISSIONS.POST_EDIT_OWN,
    PERMISSIONS.COMMENT_CREATE,
    PERMISSIONS.COMMENT_MODERATE,
  ],
  [DEFAULT_ROLES.MEMBER.slug]: [
    PERMISSIONS.COMMENT_CREATE,
    PERMISSIONS.WALLET_VIEW_OWN,
    PERMISSIONS.DOWNLOAD_PURCHASE,
  ],
};
