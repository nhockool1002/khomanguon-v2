"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { PERMISSIONS } from "@/lib/permissions";
import type { MaintenanceModeSettings } from "@/lib/types";
import { MaintenancePage } from "./maintenance-page";

// Các trang xác thực tài khoản LUÔN phải truy cập được dù Chế độ Bảo trì đang bật — nếu không, một
// user có quyền maintenance.bypass nhưng đang bị đăng xuất (hết hạn phiên, đổi máy...) sẽ không có
// cách nào đăng nhập lại để chứng minh mình có quyền, tự khoá luôn chính mình khỏi site.
const EXEMPT_PREFIXES = [
  "/dang-nhap",
  "/dang-ky",
  "/quen-mat-khau",
  "/dat-lai-mat-khau",
  "/xac-minh-email",
];

// Bọc TOÀN BỘ layout (Navbar/children/Footer) — không chỉ {children} — vì user bị chặn không nên
// thấy Navbar/Footer bình thường rồi bấm vào đâu cũng bị chặn tiếp, gây rối; họ chỉ nên thấy đúng 1
// trang bảo trì full-screen. User có quyền maintenance.bypass (Admin luôn có qua ALL_PERMISSION_KEYS)
// thấy site bình thường, kèm banner cảnh báo để biết site đang ở chế độ này (khách thường sẽ không
// vào được).
export function MaintenanceGate({
  maintenance,
  children,
}: {
  maintenance: MaintenanceModeSettings;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  if (!maintenance.enabled) return <>{children}</>;
  if (EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) return <>{children}</>;

  // Chưa biết user là ai (đang refresh token lúc mount) — đợi thay vì vội kết luận là khách thường,
  // tránh nháy trang bảo trì rồi biến mất ngay với user có quyền bypass.
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#16181d]" />;
  }

  const canBypass = user?.permissionKeys?.includes(PERMISSIONS.MAINTENANCE_BYPASS);
  if (!canBypass) return <MaintenancePage message={maintenance.message} />;

  return (
    <>
      <div className="bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-white">
        ⚠ Website đang trong chế độ Bảo trì — chỉ tài khoản được cấp quyền mới thấy được nội dung
        này, khách vãng lai sẽ thấy trang bảo trì.
      </div>
      {children}
    </>
  );
}
