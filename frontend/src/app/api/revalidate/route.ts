import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// Webhook nội bộ — backend (aaPanel) gọi route này sau khi Admin bấm "Xoá cache" trên topbar hoặc
// khi nội dung thay đổi, để purge cache trang/ISR của Next.js bên phía Vercel (2 domain tách biệt
// nên không revalidatePath() in-process được, xem backend/src/cache/frontend-revalidate.service.ts).
// Xác thực bằng secret dùng chung REVALIDATE_SECRET — không public, không nằm trong NEXT_PUBLIC_*.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-revalidate-secret");
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ message: "Không có quyền truy cập" }, { status: 401 });
  }

  // Purge toàn bộ cây route Layout gốc — tương đương nút "Xoá cache toàn bộ" của WP-Rocket/
  // LiteSpeed, đơn giản và chắc chắn đúng hơn so với revalidate từng tag lẻ tẻ.
  revalidatePath("/", "layout");

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
