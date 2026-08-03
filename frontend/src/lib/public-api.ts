import type {
  Category,
  GeneralSettings,
  MenuItem,
  PostDetail,
  PostListResponse,
  PublicProfile,
  RoleBadgeInfo,
  Widget,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Fetch phía server cho các trang công khai (trang chủ/danh mục/chi tiết) — không cần access
// token. ISR (PLAN.md 4.2): cache theo revalidateSeconds thay vì "no-store" như trước — Next.js
// tự suy ra thời gian revalidate của cả trang từ các lệnh fetch dùng trong Server Component, không
// cần khai báo `export const revalidate` riêng ở từng page.tsx. Mặc định 30s là đủ nhanh để nội
// dung mới (bài đăng, sửa cài đặt...) hiện ra mà vẫn được hưởng lợi cache giữa các lượt truy cập.
async function publicFetch<T>(path: string, revalidateSeconds = 30): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchPosts(params: {
  categorySlug?: string;
  q?: string;
  sort?: "newest" | "popular";
  page?: number;
  limit?: number;
}): Promise<PostListResponse> {
  const query = new URLSearchParams();
  if (params.categorySlug) query.set("category", params.categorySlug);
  if (params.q) query.set("q", params.q);
  if (params.sort) query.set("sort", params.sort);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const result = await publicFetch<PostListResponse>(`/posts?${query.toString()}`);
  return result ?? { items: [], total: 0 };
}

export async function fetchPostBySlug(slug: string): Promise<PostDetail | null> {
  return publicFetch<PostDetail>(`/posts/${slug}`);
}

export async function fetchPublicProfile(id: string): Promise<PublicProfile | null> {
  return publicFetch<PublicProfile>(`/users/${id}/public-profile`);
}

export async function fetchCategories(): Promise<Category[]> {
  const result = await publicFetch<Category[]>("/categories");
  return result ?? [];
}

export async function fetchMenus(): Promise<MenuItem[]> {
  const result = await publicFetch<MenuItem[]>("/menus");
  return result ?? [];
}

// Lọc area + isActive + công khai (roleSlugs rỗng) ở đây — cùng giới hạn với fetchMenus/navbar.tsx:
// chưa lọc theo role cụ thể của user vì AuthUser client-side chưa có roles (để dành bản sau).
export async function fetchWidgets(area: string): Promise<Widget[]> {
  const result = await publicFetch<Widget[]>("/widgets");
  return (result ?? [])
    .filter((w) => w.area === area && w.isActive && w.roleSlugs.length === 0)
    .sort((a, b) => a.order - b.order);
}

// Style badge role (title/color/bold/italic/font) — công khai vì hiện cạnh bình luận/byline bài
// viết, khách vãng lai cũng cần thấy đúng. Fetch 1 lần ở layout.tsx, truyền qua RoleBadgesProvider.
export async function fetchRoleBadges(): Promise<RoleBadgeInfo[]> {
  const result = await publicFetch<RoleBadgeInfo[]>("/roles/badges");
  return result ?? [];
}

// Fallback y hệt DEFAULT_GENERAL_SETTINGS ở backend/src/settings/site-settings.types.ts —
// giữ trang chủ vẫn render hợp lý nếu API lỗi/backend chưa deploy migration mới.
export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  postsPerPage: 9,
  headerTitle: "khomanguon.vn",
  headerSlogan:
    "Mở kho, dựng lại thanh xuân — kho mã nguồn Game/Web/App cho cộng đồng Việt",
  headerBackgroundColor: "#1d3557",
  headerBackgroundImageUrl: null,
  headerBackgroundSize: "cover",
  headerBackgroundAttachment: "scroll",
  headerBackgroundPositionX: 50,
  headerBackgroundPositionY: 50,
  headerMinHeight: 260,
  headerTitleColor: "#c7d2e0",
  headerTitleFontFamily: null,
  headerTitleBold: false,
  headerSloganColor: "#ffffff",
  headerSloganFontFamily: null,
  headerSloganBold: true,
  headerSloganItalic: false,
  gaTrackingId: "",
  googleSiteVerification: "",
};

export async function fetchGeneralSettings(): Promise<GeneralSettings> {
  const result = await publicFetch<GeneralSettings>("/settings/general");
  return result ?? DEFAULT_GENERAL_SETTINGS;
}
