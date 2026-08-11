export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  // Gợi ý hiển thị UI (vd nút "Xoá cache" ở topbar, xem navbar.tsx) — chỉ /users/me trả về field
  // này (login/register chưa có, xem backend/src/auth/auth.service.ts PublicUser), nên optional.
  // Backend luôn kiểm tra lại bằng PermissionsGuard nên sai/thiếu ở đây chỉ ảnh hưởng UI.
  permissionKeys?: string[];
  // Bật/tắt popup gợi ý bài viết ngẫu nhiên (post-popup.tsx) — optional cùng lý do permissionKeys.
  showPostPopup?: boolean;
}

export interface UserTitleConfig {
  cooldownDays: number | null; // null = đổi tự do, không giới hạn ngày
  allowHtml: boolean;
  maxLength: number;
}

export interface Profile extends AuthUser {
  bio: string | null;
  title: string | null;
  createdAt: string;
  roles: string[];
  // Vai trò của chính user này (kèm tên hiển thị) — dùng cho selector "hiển thị theo vai trò"
  // ở trang Tài khoản khi user thuộc >1 role.
  styleRoles: { slug: string; name: string }[];
  primaryRoleSlug: string | null;
  // Super Moderator trở lên đổi tên hiển thị tự do; còn lại chỉ 1 lần (xem users.service.ts).
  canChangeDisplayName: boolean;
  // User Title — cấu hình gộp từ mọi role (xem backend roles/user-title.util.ts) + trạng thái
  // cooldown hiện tại (xem users.service.ts updateTitle()).
  userTitleConfig: UserTitleConfig;
  canChangeTitle: boolean;
  titleChangeAvailableAt: string | null;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export type UserActivityType = "LOGIN" | "VIEW_POST" | "DEPOSIT" | "VISIT_PROFILE" | "COMMENT";

export interface UserActivity {
  id: string;
  type: UserActivityType;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export type PostStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED";

export interface Category {
  id: string;
  name: string;
  slug: string;
  order: number;
  parentId: string | null;
}

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface PostAuthor {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  styleRoleSlug: string | null;
}

export interface PostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  thumbnailUrl: string | null;
  status: PostStatus;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  category: CategoryRef | null;
  tags: Tag[];
  author: PostAuthor;
}

export interface PostDetail extends PostSummary {
  contentHtml: string;
  categoryId: string | null;
  authorId: string;
  updatedAt: string;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
  canonicalUrl: string | null;
  jsonLd: string | null;
}

export interface PostListResponse {
  items: PostSummary[];
  total: number;
}

export interface BookmarkStatus {
  postId: string;
  bookmarked: boolean;
}

export interface BookmarkListResponse {
  items: (PostSummary & { bookmarkedAt: string })[];
  total: number;
}

export interface MenuItem {
  id: string;
  label: string;
  url: string;
  icon: string | null;
  order: number;
  openInNewTab: boolean;
  parentId: string | null;
  roleSlugs: string[];
}

export type WidgetType =
  | "SEARCH"
  | "CATEGORIES"
  | "RECENT_POSTS"
  | "HTML"
  | "COMMENTS"
  | "TOP_VIEWED"
  | "RELATED_POSTS";

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  area: string;
  order: number;
  isActive: boolean;
  config: Record<string, unknown>;
  roleSlugs: string[];
}

export type CommentStatus = "PUBLISHED" | "HIDDEN" | "PENDING";

export interface CommentAuthor {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  styleRoleSlug: string | null;
}

export interface Comment {
  id: string;
  postId: string;
  parentId: string | null;
  content: string;
  status: CommentStatus;
  pinned: boolean;
  createdAt: string;
  user: CommentAuthor;
  likeCount: number;
  likedByMe: boolean;
}

export interface UserSearchResult {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export type NotificationType = "MENTION";

export interface AppNotification {
  id: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  actor: UserSearchResult;
  comment: { id: string; content: string } | null;
  post: { id: string; title: string; slug: string } | null;
}

// Bản ghi bình luận cho trang quản trị "Quản lý bình luận" — kèm thông tin bài viết vì kiểm duyệt
// xuyên suốt tất cả bài viết, không chỉ trong ngữ cảnh 1 bài như listForModeration(postId).
export interface AdminComment extends Comment {
  post: { id: string; title: string; slug: string };
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  isSystem: boolean;
  title: string | null;
  color: string | null;
  bold: boolean;
  italic: boolean;
  fontFamily: string | null;
  // Quyền hạn User Title cho user thuộc role này (xem /admin/roles) — null cooldown = đổi tự do.
  userTitleCooldownDays: number | null;
  userTitleAllowHtml: boolean;
  userTitleMaxLength: number;
  permissionKeys: string[];
}

export interface RoleBadgeInfo {
  slug: string;
  name: string;
  title: string | null;
  color: string | null;
  bold: boolean;
  italic: boolean;
  fontFamily: string | null;
}

export type UserStatus = "ACTIVE" | "BANNED";

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  createdAt: string;
  roles: { slug: string; name: string }[];
}

export interface Permission {
  id: string;
  key: string;
  description: string;
}

export interface AdminWalletTransaction extends WalletTransaction {
  user: { id: string; email: string; displayName: string };
}

export type StorageProviderType = "R2" | "S3" | "MAILJET";

export interface StorageProvider {
  id: string;
  type: StorageProviderType;
  label: string;
  endpoint: string | null;
  region: string | null;
  bucket: string | null;
  uploadPrefix: string | null;
  publicBaseUrl: string | null;
  accessKeyId: string;
  isDefault: boolean;
  createdAt: string;
}

// Nguồn khả dụng cho Thư viện Media (tab Local/R2/S3) — GET /media/storage-targets, rút gọn từ
// StorageProvider (chỉ Provider đang isDefault + đã cấu hình publicBaseUrl mới xuất hiện ở đây).
export interface MediaStorageTarget {
  id: string;
  type: "R2" | "S3";
  label: string;
}

export interface BackupConfig {
  enabled: boolean;
  hour: number;
  minute: number;
  retentionCount: number;
  storageProviderId: string | null;
}

export type DbBackupStatus = "SUCCESS" | "FAILED";

export interface DbBackupRecord {
  id: string;
  status: DbBackupStatus;
  sizeBytes: number | null;
  storageProviderId: string | null;
  objectKey: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export type CloudUploadStatus = "SUCCESS" | "FAILED" | "CANCELLED";

export interface CloudUploadRecord {
  id: string;
  fileName: string;
  objectKey: string | null;
  folder: string | null;
  sizeBytes: number | null;
  status: CloudUploadStatus;
  errorMessage: string | null;
  storageProviderId: string | null;
  providerLabel: string | null;
  uploadedBy: { id: string; displayName: string } | null;
  createdAt: string;
}

export interface DownloadLinkAdmin {
  id: string;
  label: string;
  objectKey: string;
  sizeBytes: number | null;
  priceP: number;
}

export interface DownloaderInfo {
  id: string;
  displayName: string;
  styleRoleSlug: string | null;
}

export interface DownloadLinkPublic extends DownloadLinkAdmin {
  downloaders: DownloaderInfo[];
}

export type LinkReportStatus = "PENDING" | "RESOLVED";

export interface LinkReport {
  id: string;
  note: string | null;
  status: LinkReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  downloadLink: {
    id: string;
    label: string;
    objectKey: string;
    post: { id: string; title: string; slug: string };
  };
  reporter: { id: string; displayName: string; email: string };
  resolvedBy: { id: string; displayName: string } | null;
}

export type FeedbackStatus = "PENDING" | "RESOLVED";

export interface Feedback {
  id: string;
  name: string | null;
  email: string | null;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
  resolvedAt: string | null;
  author: { id: string; displayName: string; email: string } | null;
  resolvedBy: { id: string; displayName: string } | null;
}

export interface NewsletterConfig {
  enabled: boolean;
  dayOfWeek: number;
  hour: number;
  minute: number;
  lastSentAt: string | null;
}

export interface NewsletterSubscriberCount {
  active: number;
  total: number;
}

export interface NewsletterSendResult {
  sent: number;
  postCount: number;
  skippedReason?: string;
}

export type AuditAction =
  | "ROLE_ASSIGNED"
  | "ROLE_REMOVED"
  | "WALLET_ADJUSTED"
  | "STORAGE_PROVIDER_KEY_CHANGED"
  | "DOWNLOAD_BYPASSED";

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; displayName: string; email: string };
}

export interface Wallet {
  balance: number;
  updatedAt: string;
}

export interface TopupPreset {
  vnd: number;
  p: number;
}

export interface SepayConfigPublic {
  bankAccountNumber: string;
  bankName: string;
  accountHolderName: string;
  hasApiKey: boolean;
  hasApiAccessToken: boolean;
  baseRateVndPerP: number;
  presets: TopupPreset[];
}

export type TopupOrderStatus = "PENDING" | "SUCCESS" | "EXPIRED";

export interface TopupOrder {
  id: string;
  userId: string;
  code: string;
  amountVnd: number;
  amountP: number;
  status: TopupOrderStatus;
  expiresAt: string;
  createdAt: string;
}

export interface TopupOrderWithQr {
  order: TopupOrder;
  qrUrl: string;
}

// ───────────────────────── Gói Subscription/VIP ─────────────────────────

export interface SubscriptionPlan {
  id: string;
  name: string;
  durationDays: number;
  priceVnd: number;
  totalDownloadLimit: number | null;
  dailyDownloadLimit: number | null;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionOrderStatus = "PENDING" | "SUCCESS" | "EXPIRED";

export interface SubscriptionOrder {
  id: string;
  userId: string;
  planId: string;
  plan: SubscriptionPlan;
  code: string;
  amountVnd: number;
  status: SubscriptionOrderStatus;
  expiresAt: string;
  createdAt: string;
}

export interface SubscriptionOrderWithQr {
  order: SubscriptionOrder;
  qrUrl: string;
}

export interface MySubscriptionStatus {
  plan: SubscriptionPlan;
  startsAt: string;
  endsAt: string;
  totalDownloadsUsed: number;
  dailyDownloadsUsed: number;
}

export type WalletTxType = "TOPUP" | "PURCHASE" | "ADMIN_ADJUST" | "REFUND";
export type WalletTxStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface WalletTransaction {
  id: string;
  type: WalletTxType;
  amount: number;
  balanceAfter: number;
  status: WalletTxStatus;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
  // Ghép thêm ở backend/src/wallet/wallet.service.ts enrich() theo từng loại giao dịch — luôn có
  // mặt trên mọi item (null nếu không áp dụng loại đó) để đối soát chi tiết trên UI.
  amountVnd: number | null; // TOPUP — số VNĐ đã chuyển khoản qua SePay
  postSlug: string | null; // PURCHASE — bài viết chứa link tải vừa mua, dùng để gắn link
  adminDisplayName: string | null; // ADMIN_ADJUST — tên Admin đã điều chỉnh tay
}

export interface WalletTransactionListResponse {
  items: WalletTransaction[];
  total: number;
}

export interface CloudFile {
  key: string;
  sizeBytes: number;
  lastModified: string | null;
  downloadCount: number;
  memberNames: string[];
  revenueP: number;
  linkedPostTitles: string[];
}

export type HeaderBackgroundSize = "cover" | "contain" | "auto";
export type HeaderBackgroundAttachment = "scroll" | "fixed";

export interface RateLimitRule {
  windowSec: number;
  max: number;
}

export interface RateLimitSettings {
  enabled: boolean;
  login: RateLimitRule;
  register: RateLimitRule;
  forgotPassword: RateLimitRule;
  resetPassword: RateLimitRule;
  search: RateLimitRule;
  commentCreate: RateLimitRule;
  feedbackCreate: RateLimitRule;
  newsletterSubscribe: RateLimitRule;
}

export interface MaintenanceModeSettings {
  enabled: boolean;
  message: string;
}

export interface GeneralSettings {
  postsPerPage: number;
  siteTitle: string;
  headerTitle: string;
  headerSlogan: string;
  headerBackgroundColor: string;
  headerBackgroundImageUrl: string | null;
  headerBackgroundSize: HeaderBackgroundSize;
  headerBackgroundAttachment: HeaderBackgroundAttachment;
  headerBackgroundPositionX: number;
  headerBackgroundPositionY: number;
  headerMinHeight: number;
  headerTitleColor: string;
  headerTitleFontFamily: string | null;
  headerTitleBold: boolean;
  headerSloganColor: string;
  headerSloganFontFamily: string | null;
  headerSloganBold: boolean;
  headerSloganItalic: boolean;
  gaTrackingId: string;
  googleSiteVerification: string;
  footerText: string;
  rateLimits: RateLimitSettings;
  maintenanceMode: MaintenanceModeSettings;
}

export interface RecaptchaAdminConfig {
  enabled: boolean;
  siteKey: string;
  hasSecretKey: boolean;
}

export interface MailTemplateConfig {
  subject: string;
  html: string;
}

export interface MailTemplates {
  notifyEmail: string;
  topupSuccess: MailTemplateConfig;
  downloadUnlock: MailTemplateConfig;
  passwordReset: MailTemplateConfig;
  linkReportAdmin: MailTemplateConfig;
  linkReportResolved: MailTemplateConfig;
  verifyEmail: MailTemplateConfig;
  feedbackAdmin: MailTemplateConfig;
}

export interface MediaFile {
  // Đường dẫn tương đối (từ /uploads) — dùng làm id vì Thư viện Media liệt kê trực tiếp từ đĩa
  // (uploads/posts/yyyy/mm/dd/...), không có bảng riêng để cấp primary key ổn định cho mọi file.
  path: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { displayName: string } | null;
}

export interface MediaFileListResponse {
  items: MediaFile[];
  total: number;
}

export interface PublicProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  title: string | null;
  // true = render title qua dangerouslySetInnerHTML (role hiện tại của chủ profile cho phép HTML);
  // false = render như text thường (React tự escape) — luôn tin theo cờ này, không tự đoán bằng
  // cách "nhìn" nội dung title (xem backend users.service.ts getPublicProfile()).
  titleAllowHtml: boolean;
  createdAt: string;
  styleRoleSlug: string | null;
  roleNames: string[];
}

export interface ProfileMessageAuthor {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  styleRoleSlug: string | null;
}

export interface ProfileMessage {
  id: string;
  content: string;
  createdAt: string;
  author: ProfileMessageAuthor;
}

export interface ProfileMessageListResponse {
  items: ProfileMessage[];
  total: number;
}
