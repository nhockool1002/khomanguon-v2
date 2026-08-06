import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

// PLAN.md 2.6 — chặn crawl khu quản trị/tài khoản, cho phép hết phần công khai.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/tai-khoan/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
