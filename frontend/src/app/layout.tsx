import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { RoleBadgesProvider } from "@/context/role-badges-context";
import { Navbar } from "@/components/navbar";
import { PostPopup } from "@/components/post-popup";
import { Footer } from "@/components/footer";
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
      className={`${geistSans.variable} ${geistMono.variable} ${ROLE_FONT_VARS} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
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
            <Navbar menus={menus} />
            {children}
            <Footer text={settings.footerText} />
            <PostPopup />
          </RoleBadgesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
