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
