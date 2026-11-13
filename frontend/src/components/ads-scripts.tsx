"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { ADS_ONCLICK_SCRIPT, ADS_VIGNETTE_SCRIPT } from "@/lib/ads-config";

// Tách khỏi layout.tsx (Server Component, không biết pathname) thành Client Component riêng để
// loại trừ /admin/* — Onclick gắn listener bắt MỌI click trên trang, nên nếu tải luôn ở đây thì
// thao tác quản trị (kể cả nút ẩn "Admin Get Presigned Link" ở download-box.tsx) cũng bị kích hoạt
// quảng cáo, điều này không hợp lý vì đó là nơi làm việc của Admin, không phải trang khách xem.
export function AdsScripts({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  if (!enabled || !pathname || pathname.startsWith("/admin")) return null;

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
