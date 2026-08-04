import Link from "next/link";
import { ShieldX } from "lucide-react";

// Hiện khi user đăng nhập cố tình vào thẳng URL /quan-tri/* mà không có quyền tương ứng (xem
// lib/admin-nav.ts) — chặn ở từng trang thay vì chỉ dựa vào lỗi 403 im lặng từ API.
export function ForbiddenPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-24 text-center">
      <ShieldX size={40} strokeWidth={1.5} className="text-zinc-300" aria-hidden />
      <h1 className="text-lg font-semibold text-zinc-900">403 — Không có quyền truy cập</h1>
      <p className="max-w-sm text-sm text-zinc-500">
        Tài khoản của bạn không có quyền vào trang này. Liên hệ Admin nếu bạn cho rằng đây là nhầm
        lẫn.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a]"
      >
        Về trang chủ
      </Link>
    </div>
  );
}
