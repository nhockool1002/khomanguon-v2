import type { Metadata, Viewport } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { RoleBadgesProvider } from "@/context/role-badges-context";
import { GlobalLoadingBar } from "@/components/global-loading-bar";
import { VisitTracker } from "@/components/visit-tracker";
import { AdsScripts } from "@/components/ads-scripts";
import { SiteShell } from "@/components/site-shell";
import { fetchGeneralSettings, fetchMenus, fetchRoleBadges } from "@/lib/public-api";
import { ROLE_FONT_VARS } from "@/lib/fonts";

// Font lưu sẵn trong src/fonts (không tải từ Google lúc build — xem ghi chú ở lib/fonts.ts).
const geistSans = localFont({
  src: "../fonts/geist-latin.woff2",
  weight: "100 900",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "../fonts/geist-mono-latin.woff2",
  weight: "100 900",
  variable: "--font-geist-mono",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d3557",
};

// generateMetadata thay vì export const metadata tĩnh — cần đọc googleSiteVerification từ
// Cài đặt chung (PLAN.md 2.6), giá trị này chỉ biết được lúc request-time.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchGeneralSettings();
  return {
    title: settings.siteTitle,
    description:
      "Kho mã nguồn Game/Web/App lớn nhất cho cộng đồng Việt — tải server offline, VM 1-click, tool GM, kèm ví $P nạp tự động qua SePay.",
    verification: settings.googleSiteVerification
      ? { google: settings.googleSiteVerification }
      : undefined,
    alternates: {
      types: { "application/rss+xml": "/rss.xml" },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [menus, roleBadges, settings] = await Promise.all([
    fetchMenus(),
    fetchRoleBadges(),
    fetchGeneralSettings(),
  ]);

  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} ${ROLE_FONT_VARS} h-full overflow-x-hidden antialiased`}
    >
      {/* overflow-x-hidden trên cả html lẫn body — chặn cả trang bị cuộn ngang trên mobile nếu có
          phần tử nào lỡ tràn viewport (vd Tooltip position:absolute width:max-content ở ui.tsx khi
          nội dung dài), thay vì để cả layout (kể cả navbar) bị lệch sang trái. Không có phần tử
          position:sticky nào trong site nên an toàn, không phá layout gì. */}
      <body className="flex min-h-full flex-col overflow-x-hidden">
        <GlobalLoadingBar />
        <VisitTracker />
        {settings.gaTrackingId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${settings.gaTrackingId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${settings.gaTrackingId}');`}
            </Script>
          </>
        )}
        {/* Quảng cáo Monetag toàn site (PLAN bổ sung 2026-11-13) — Admin tắt được qua công tắc
            "adsEnabled" ở Cài đặt chung (/admin/settings/general), không cần đụng code. Onclick
            (popunder) tự bắt mọi click trên trang (kể cả nút Tải xuống) nên không cần sửa riêng
            component download-box.tsx. Vignette là banner native không chiếm layout. Push
            Notifications CHƯA bật — xem ghi chú trong lib/ads-config.ts (rủi ro mất xác minh site).
            Tách sang Client Component riêng (ads-scripts.tsx) để tự loại trừ /admin/* bằng
            usePathname — layout.tsx là Server Component, không biết được pathname hiện tại. */}
        <AdsScripts enabled={settings.adsEnabled} />
        <AuthProvider>
          <RoleBadgesProvider badges={roleBadges}>
            <SiteShell
              menus={menus}
              footerText={settings.footerText}
              maintenance={settings.maintenanceMode}
            >
              {children}
            </SiteShell>
          </RoleBadgesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
