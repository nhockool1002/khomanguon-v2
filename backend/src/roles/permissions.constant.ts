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
  // Hàng chờ xử lý góp ý từ modal Feedback toàn site (khác DOWNLOAD_MANAGE_LINKS — đó là báo lỗi
  // link tải cụ thể, đây là góp ý chung chung, mức nhạy cảm tương đương nên cũng gán mặc định cho
  // Super Moderator, xem DEFAULT_ROLE_PERMISSIONS bên dưới).
  FEEDBACK_MANAGE: 'feedback.manage',
  NEWSLETTER_MANAGE: 'newsletter.manage',
  // Truy cập được toàn site khi Chế độ Bảo trì đang bật (GeneralSettings.maintenanceMode, xem
  // maintenance-gate.tsx) — gán cho role nào tuỳ Admin qua trang Quản lý Permission, không có danh
  // sách roleSlugs riêng. Admin luôn có quyền này qua ALL_PERMISSION_KEYS.
  MAINTENANCE_BYPASS: 'maintenance.bypass',
  // Nút ẩn "Admin Get Presigned Link" trên trang bài viết — tạo link tải cho bất kỳ bài nào mà
  // KHÔNG trừ $P, KHÔNG ghi WalletTransaction/DownloadGrant/DownloadEvent (xem
  // download-links.service.ts adminBypassUnlock). Không gán mặc định cho Super Moderator (xem
  // DEFAULT_ROLE_PERMISSIONS bên dưới) — chỉ Admin có qua ALL_PERMISSION_KEYS, role khác muốn dùng
  // phải được cấp riêng qua trang Phân quyền.
  DOWNLOAD_BYPASS: 'download.bypass',
  SETTINGS_SEO: 'settings.seo',
  SETTINGS_STORAGE_KEYS: 'settings.storage_keys',
  SETTINGS_PAYMENT: 'settings.payment',
  SETTINGS_GENERAL: 'settings.general',
  MEDIA_MANAGE: 'media.manage',
  SETTINGS_MAIL: 'settings.mail',
  CACHE_MANAGE: 'cache.manage',
  // Backup DB chứa toàn bộ dữ liệu hệ thống — mức nhạy cảm cao nhất, KHÔNG gán cho Super Moderator
  // mặc định (xem DEFAULT_ROLE_PERMISSIONS bên dưới, chỉ admin có qua ALL_PERMISSION_KEYS). Permission
  // mới thêm sau khi seed đã chạy vẫn tự backfill cho Admin lần deploy tiếp theo — seed.ts dùng
  // upsert cho vòng lặp linking role<->permission, không chỉ chạy 1 lần lúc tạo role mới.
  SETTINGS_BACKUP: 'settings.backup',
  // Audit log (đổi quyền, chỉnh ví tay, đổi key R2/S3) — cùng mức nhạy cảm với SETTINGS_BACKUP,
  // KHÔNG gán cho Super Moderator mặc định (xem DEFAULT_ROLE_PERMISSIONS bên dưới).
  AUDIT_VIEW: 'audit.view',
  // Quản lý gói Subscription/VIP (giá, thời hạn, giới hạn tải) — xem subscription-plans module.
  SETTINGS_SUBSCRIPTION: 'settings.subscription',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSION_KEYS: PermissionKey[] = Object.values(PERMISSIONS);

export const DEFAULT_ROLES = {
  ADMIN: { slug: 'admin', name: 'Admin' },
  SUPER_MODERATOR: { slug: 'super-moderator', name: 'Super Moderator' },
  MODERATOR: { slug: 'moderator', name: 'Moderator' },
  MEMBER: { slug: 'member', name: 'Member' },
  // Gán mặc định lúc đăng ký — chưa xác minh email thì chỉ xem được bài viết (đã public, không
  // cần permission riêng), không bình luận/không tải file được. Nâng cấp lên MEMBER tự động ngay
  // khi verifyEmail() thành công (xem roles.service.ts upgradeAfterVerification).
  UNVERIFIED: { slug: 'unverified', name: 'Chưa kích hoạt' },
  // Gán/gỡ tự động khi mua/hết hạn gói Subscription (xem subscription.service.ts) — CHỈ để nhóm/
  // hiển thị (badge, lọc danh sách user), quyền tải miễn phí/quota thật sự đọc thẳng
  // SubscriptionMembership.status="ACTIVE" && endsAt>now (không phụ thuộc role này để tránh lệch
  // nếu cron gỡ role trễ 1 nhịp — xem subscription.service.ts checkFreeDownloadEligibility).
  // MEMBER vẫn giữ nguyên song song (đa role), không bị gỡ khi lên Subscription.
  SUBSCRIPTION: { slug: 'subscription', name: 'Subscription' },
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
    PERMISSIONS.FEEDBACK_MANAGE,
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
  // Không có quyền nào — "chỉ xem được bài viết" (xem bài viết vốn đã public, không cần permission)
  // "nhưng không tải được": cũng chặn luôn bình luận/ví cho tới khi xác minh email, đúng nghĩa
  // "chưa kích hoạt". Admin có thể nới lỏng qua trang Phân quyền nếu muốn cho bình luận trước.
  [DEFAULT_ROLES.UNVERIFIED.slug]: [],
  // Không có quyền RBAC riêng — quyền lợi Subscription (tải free theo quota) đọc thẳng
  // SubscriptionMembership, không qua permission. Role này chỉ để nhóm/hiển thị badge.
  [DEFAULT_ROLES.SUBSCRIPTION.slug]: [],
};

export interface RoleUserTitleConfig {
  cooldownDays: number | null; // null = đổi tự do, không giới hạn ngày
  allowHtml: boolean;
  maxLength: number;
}

// Mặc định User Title cho 4 role hệ thống lúc khởi tạo (seed.ts — chỉ áp khi TẠO MỚI role, không
// ghi đè role đã tồn tại để không xoá tuỳ chỉnh Admin đã lưu qua /admin/roles). Role không có
// trong map này (custom role Admin tự tạo, hoặc UNVERIFIED) dùng default cột trong schema.prisma
// (60 ngày / không HTML / 150 ký tự) làm baseline an toàn.
export const DEFAULT_ROLE_USER_TITLE_CONFIG: Partial<
  Record<string, RoleUserTitleConfig>
> = {
  [DEFAULT_ROLES.MEMBER.slug]: {
    cooldownDays: 60,
    allowHtml: false,
    maxLength: 150,
  },
  [DEFAULT_ROLES.MODERATOR.slug]: {
    cooldownDays: 30,
    allowHtml: false,
    maxLength: 150,
  },
  [DEFAULT_ROLES.SUPER_MODERATOR.slug]: {
    cooldownDays: null,
    allowHtml: true,
    maxLength: 500,
  },
  [DEFAULT_ROLES.ADMIN.slug]: {
    cooldownDays: null,
    allowHtml: true,
    maxLength: 500,
  },
};
