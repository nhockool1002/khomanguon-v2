import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { RoleBadgesProvider } from "@/context/role-badges-context";
import { GlobalLoadingBar } from "@/components/global-loading-bar";
import { SiteShell } from "@/components/site-shell";
import { fetchGeneralSettings, fetchMenus, fetchRoleBadges } from "@/lib/public-api";
import { ROLE_FONT_VARS } from "@/lib/fonts";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
