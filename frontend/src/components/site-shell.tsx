"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { PERMISSIONS } from "@/lib/permissions";
import type { MaintenanceModeSettings, MenuItem } from "@/lib/types";
import { Navbar } from "./navbar";
import { Footer } from "./footer";
import { NewsletterSignup } from "./newsletter-signup";
import { PostPopup } from "./post-popup";

const MAINTENANCE_PATH = "/bao-tri";

// Các trang xác thực tài khoản LUÔN phải truy cập được dù Chế độ Bảo trì đang bật — nếu không, 1
// user có quyền maintenance.bypass nhưng đang bị đăng xuất (hết hạn phiên, đổi máy...) sẽ không có
// cách nào đăng nhập lại để chứng minh mình có quyền, tự khoá luôn chính mình khỏi site.
const EXEMPT_PREFIXES = [
  "/dang-nhap",
  "/dang-ky",
  "/quen-mat-khau",
  "/dat-lai-mat-khau",
  "/xac-minh-email",
];

// Thay cho việc layout.tsx (Server Component, không có usePathname) render thẳng
// Navbar/{children}/Footer — gom hết vào đây để: (1) gác Chế độ Bảo trì (route thật /bao-tri, xem
// app/bao-tri/page.tsx — router.replace() cùng pattern gate quyền đã dùng ở mọi trang /admin/*),
// (2) ẩn hẳn Navbar/Footer/NewsletterSignup khi đang ở đúng trang /bao-tri để nó hiện full-screen,
// không bị kẹp giữa thanh nav sáng màu và footer.
export function SiteShell({
  menus,
  footerText,
  maintenance,
  children,
}: {
  menus: MenuItem[];
  footerText: string;
  maintenance: MaintenanceModeSettings;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  const isMaintenancePage = pathname === MAINTENANCE_PATH;
  const isExempt = isMaintenancePage || EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
  const canBypass = user?.permissionKeys?.includes(PERMISSIONS.MAINTENANCE_BYPASS);
  // Chưa biết user là ai (đang refresh token lúc mount) — chưa vội kết luận là khách thường, tránh
  // redirect nhầm 1 user có quyền bypass ngay trước khi useAuth() kịp xác nhận quyền của họ.
  const shouldRedirect = maintenance.enabled && !isExempt && !loading && !canBypass;

  useEffect(() => {
    if (shouldRedirect) router.replace(MAINTENANCE_PATH);
  }, [shouldRedirect, router]);

  // Đúng trang /bao-tri — chỉ render nội dung trang đó (MaintenancePage, full-screen), không kẹp
  // Navbar/Footer/NewsletterSignup quanh nó.
  if (isMaintenancePage) return <>{children}</>;

  if (maintenance.enabled && !isExempt && (loading || !canBypass)) {
    // Đang đợi useAuth() xác nhận quyền, hoặc đang đợi router.replace() ở trên hoàn tất — không
    // render Navbar/nội dung thật (dù chỉ trong chốc lát) để tránh lộ nội dung rồi mới bị đẩy đi.
    return <div className="min-h-screen bg-[#16181d]" />;
  }

  return (
    <>
      {maintenance.enabled && canBypass && !isExempt && (
        <div className="bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-white">
          ⚠ Website đang trong chế độ Bảo trì — chỉ tài khoản được cấp quyền mới thấy được nội dung
          này, khách vãng lai sẽ bị đưa về trang bảo trì.
        </div>
      )}
      <Navbar menus={menus} />
      {children}
      <NewsletterSignup />
      <Footer text={footerText} />
      <PostPopup />
    </>
  );
}
