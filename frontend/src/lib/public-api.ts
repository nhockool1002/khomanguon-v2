import type { Category, MenuItem, PostDetail, PostListResponse, Widget } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Fetch phía server cho các trang công khai (trang chủ/danh mục/chi tiết) —
// không cần access token, luôn lấy dữ liệu mới (chưa làm SSR/ISR cache, xem PLAN.md Phase 4.2).
async function publicFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
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
