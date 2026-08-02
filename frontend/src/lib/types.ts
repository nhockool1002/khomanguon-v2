export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
}

export interface Profile extends AuthUser {
  bio: string | null;
  createdAt: string;
  roles: string[];
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export type PostStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED";

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface PostAuthor {
  id: string;
  displayName: string;
  avatarUrl: string | null;
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
}

export interface PostListResponse {
  items: PostSummary[];
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

export type WidgetType = "SEARCH" | "CATEGORIES" | "RECENT_POSTS" | "HTML";

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
  permissionKeys: string[];
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

export type StorageProviderType = "R2" | "S3" | "MAILJET";

export interface StorageProvider {
  id: string;
  type: StorageProviderType;
  label: string;
  endpoint: string | null;
  region: string | null;
  bucket: string | null;
  uploadPrefix: string | null;
  accessKeyId: string;
  isDefault: boolean;
  createdAt: string;
}

export interface DownloadLinkAdmin {
  id: string;
  label: string;
  objectKey: string;
  sizeBytes: number | null;
  priceP: number;
}

export interface DownloadLinkPublic extends DownloadLinkAdmin {
  downloaderNames: string[];
  hasAccess: boolean;
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
  createdAt: string;
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
