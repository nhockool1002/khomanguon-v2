import Link from "next/link";
import { LogoMark } from "./logo-mark";
import { MaintenanceIllustration } from "./maintenance-illustration";

// Trang toàn màn hình hiện cho user KHÔNG có quyền maintenance.bypass khi Chế độ Bảo trì đang bật
// (xem maintenance-gate.tsx). Có link "Đăng nhập" — user có tài khoản được cấp quyền bypass nhưng
// đang bị đăng xuất (hết hạn phiên...) vẫn cần vào được /dang-nhap để xác thực lại, route đó luôn
// được maintenance-gate.tsx miễn trừ.
export function MaintenancePage({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#16181d] px-6 py-16 text-center text-white">
      <MaintenanceIllustration size={200} />
      <div className="flex items-center gap-2">
        <LogoMark size={28} />
        <span className="font-mono text-sm font-semibold tracking-tight">khomanguon</span>
      </div>
      <h1 className="text-2xl font-semibold sm:text-3xl">Website đang bảo trì</h1>
      <p className="max-w-md whitespace-pre-line text-sm leading-relaxed text-zinc-300">
        {message}
      </p>
      <Link
        href="/dang-nhap"
        className="mt-2 rounded-md border border-white/20 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10"
      >
        Đăng nhập
      </Link>
    </main>
  );
}
