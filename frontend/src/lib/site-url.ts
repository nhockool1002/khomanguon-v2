// Domain thật đang chạy production theo Deploy_Checklist.md — đổi qua NEXT_PUBLIC_SITE_URL khi
// gắn domain riêng (khomanguon.vn). Dùng cho sitemap.ts/robots.ts (bắt buộc URL tuyệt đối).
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://khomanguon-v2.vercel.app";
