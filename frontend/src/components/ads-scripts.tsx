"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useAuth } from "@/context/auth-context";
import { PERMISSIONS } from "@/lib/permissions";
import { ADS_ONCLICK_SCRIPT, ADS_VIGNETTE_SCRIPT } from "@/lib/ads-config";

// Tách khỏi layout.tsx (Server Component, không biết pathname/user đăng nhập) thành Client
// Component riêng để loại trừ 2 trường hợp — Onclick gắn listener bắt MỌI click trên trang nên nếu
// tải nhầm thì không có cách nào "tắt" lại giữa chừng:
//   1. Đang ở /admin/* — nơi làm việc của Admin, không phải trang khách xem (vd nút ẩn "Admin Get
//      Presigned Link" ở download-box.tsx không nên vô tình kích hoạt quảng cáo).
//   2. Đang đăng nhập bằng tài khoản có quyền Admin (SETTINGS_GENERAL chỉ Admin có qua
//      ALL_PERMISSION_KEYS, xem permissions.constant.ts) — Admin duyệt TOÀN site (không chỉ
//      /admin) để test/vận hành thì cũng không nên thấy quảng cáo ở bất kỳ trang công khai nào.
// Chờ loading=false trước khi quyết định — nếu render luôn lúc chưa biết user là ai, Script có thể
// đã kịp tải ở lần render đầu rồi mới ẩn, nhưng Monetag đã gắn listener vào document từ đó, gỡ thẻ
// <script> sau đó KHÔNG huỷ được listener đã gắn (phải nạp lại trang mới hết, xem login-form.tsx
// xử lý hard reload cho trường hợp đăng nhập thành Admin ngay trên tab đã lỡ tải quảng cáo).
export function AdsScripts({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const isAdmin = user?.permissionKeys?.includes(PERMISSIONS.SETTINGS_GENERAL) ?? false;

  if (!enabled || loading || isAdmin || !pathname || pathname.startsWith("/admin")) return null;

  return (
    <>
      <Script id="ads-onclick" strategy="afterInteractive">
        {ADS_ONCLICK_SCRIPT}
      </Script>
      <Script id="ads-vignette" strategy="afterInteractive">
        {ADS_VIGNETTE_SCRIPT}
      </Script>
    </>
  );
}
