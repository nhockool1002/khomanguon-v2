import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { RoleBadgesProvider } from "@/context/role-badges-context";
import { Navbar } from "@/components/navbar";
import { fetchMenus, fetchRoleBadges } from "@/lib/public-api";
import { ROLE_FONT_VARS } from "@/lib/fonts";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "khomanguon — Mở kho, dựng lại thanh xuân",
  description:
    "Kho mã nguồn Game/Web/App lớn nhất cho cộng đồng Việt — tải server offline, VM 1-click, tool GM, kèm ví $P nạp tự động qua SePay.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [menus, roleBadges] = await Promise.all([fetchMenus(), fetchRoleBadges()]);

  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} ${ROLE_FONT_VARS} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          <RoleBadgesProvider badges={roleBadges}>
            <Navbar menus={menus} />
            {children}
          </RoleBadgesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
