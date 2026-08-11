// Mirror đầy đủ backend/src/roles/permissions.constant.ts — cần đủ bộ key để lọc menu quản trị
// theo quyền (admin-nav.ts) và chặn truy cập URL trực tiếp (trang 403), không chỉ 1-2 key rút gọn
// như trước. Backend vẫn luôn kiểm tra lại bằng PermissionsGuard nên sai/thiếu ở đây chỉ ảnh hưởng UI.
export const PERMISSIONS = {
  POST_CREATE: "post.create",
  POST_EDIT_OWN: "post.edit.own",
  POST_EDIT_ANY: "post.edit.any",
  POST_PUBLISH: "post.publish",
  POST_DELETE: "post.delete",
  MENU_MANAGE: "menu.manage",
  WIDGET_MANAGE: "widget.manage",
  COMMENT_CREATE: "comment.create",
  COMMENT_MODERATE: "comment.moderate",
  USER_MANAGE: "user.manage",
  USER_ASSIGN_ROLE: "user.assign_role",
  ROLE_MANAGE: "role.manage",
  WALLET_VIEW_OWN: "wallet.view.own",
  WALLET_VIEW_ANY: "wallet.view.any",
  WALLET_ADJUST: "wallet.adjust",
  DOWNLOAD_MANAGE_LINKS: "download.manage_links",
  DOWNLOAD_PURCHASE: "download.purchase",
  FEEDBACK_MANAGE: "feedback.manage",
  NEWSLETTER_MANAGE: "newsletter.manage",
  MAINTENANCE_BYPASS: "maintenance.bypass",
  SETTINGS_SUBSCRIPTION: "settings.subscription",
  // Xem thông tin Subscription (gói, hạn, quota đã tải) của NGƯỜI KHÁC ở card Subscription trang Hồ
  // sơ — chính chủ luôn xem được, không cần quyền này (xem profile-page.tsx).
  SUBSCRIPTION_VIEW_ANY: "subscription.view_any",
  // Thu hồi (revoke) gói Subscription của bất kỳ user nào trước hạn — nút "Thu hồi" ở card
  // Subscription khi xem hồ sơ người khác (xem subscription-status-view.tsx).
  SUBSCRIPTION_REVOKE: "subscription.revoke",
  DOWNLOAD_BYPASS: "download.bypass",
  SETTINGS_SEO: "settings.seo",
  SETTINGS_STORAGE_KEYS: "settings.storage_keys",
  SETTINGS_PAYMENT: "settings.payment",
  SETTINGS_GENERAL: "settings.general",
  MEDIA_MANAGE: "media.manage",
  SETTINGS_MAIL: "settings.mail",
  CACHE_MANAGE: "cache.manage",
  SETTINGS_BACKUP: "settings.backup",
  AUDIT_VIEW: "audit.view",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
