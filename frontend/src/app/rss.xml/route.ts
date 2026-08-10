import { fetchPosts } from "@/lib/public-api";
import { SITE_URL } from "@/lib/site-url";

const MAX_ITEMS = 30;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// RSS 2.0 — cùng nguồn dữ liệu công khai với sitemap.ts (fetchPosts, lọc PUBLISHED), 30 bài mới
// nhất là đủ cho 1 feed reader thông thường (không cần phân trang như sitemap). Route handler thay
// vì special-file convention (Next.js chưa có "feed.xml" convention riêng như sitemap.ts/robots.ts).
export async function GET() {
  const { items } = await fetchPosts({ sort: "newest", limit: MAX_ITEMS });
  const published = items.filter((p) => p.status === "PUBLISHED");

  const itemsXml = published
    .map((post) => {
      const link = `${SITE_URL}/bai-viet/${post.slug}`;
      const pubDate = new Date(post.publishedAt ?? post.createdAt).toUTCString();
      return `  <item>
    <title>${escapeXml(post.title)}</title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    <pubDate>${pubDate}</pubDate>
    ${post.excerpt ? `<description>${escapeXml(post.excerpt)}</description>` : ""}
    ${post.author.displayName ? `<author>${escapeXml(post.author.displayName)}</author>` : ""}
    ${post.category ? `<category>${escapeXml(post.category.name)}</category>` : ""}
  </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>khomanguon.vn</title>
  <link>${SITE_URL}</link>
  <description>Kho mã nguồn Game/Web/App cho cộng đồng Việt — bài viết mới nhất</description>
  <language>vi</language>
  <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${itemsXml}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Cùng chu kỳ ISR 30s của fetchPosts (public-api.ts) — không cần cache riêng ở CDN vì đã hưởng
      // lợi ISR/Cache-Control chuẩn của Next.js cho route handler GET tĩnh (không đọc request-specific
      // data), xem cdn-caching.md.
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
