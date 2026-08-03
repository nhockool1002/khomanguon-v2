import type { MetadataRoute } from "next";
import { fetchCategories, fetchPosts } from "@/lib/public-api";
import { SITE_URL } from "@/lib/site-url";

const MAX_PAGES = 10; // 10 trang x 50 bài/trang (giới hạn limit backend) — đủ cho quy mô hiện tại

// PLAN.md 2.6 — sitemap.xml tự sinh, không cache riêng (revalidate khi publish để dành sau, hiện
// đọc trực tiếp mỗi lần crawler gọi vì tần suất crawl thấp hơn nhiều so với traffic trang thường).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const categories = await fetchCategories();

  const allPosts: Awaited<ReturnType<typeof fetchPosts>>["items"] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { items, total } = await fetchPosts({ page, limit: 50 });
    allPosts.push(...items);
    if (allPosts.length >= total || items.length === 0) break;
  }

  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/tim-kiem`, changeFrequency: "weekly", priority: 0.3 },
    ...categories.map((c) => ({
      url: `${SITE_URL}/danh-muc/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...allPosts
      .filter((p) => p.status === "PUBLISHED")
      .map((p) => ({
        url: `${SITE_URL}/bai-viet/${p.slug}`,
        lastModified: p.publishedAt ?? p.createdAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
  ];
}
