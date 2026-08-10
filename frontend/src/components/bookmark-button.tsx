"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import type { BookmarkStatus } from "@/lib/types";

// Nút "Lưu bài viết" ở trang chi tiết — client component nhỏ lồng trong Server Component (trang
// bài viết), tự fetch trạng thái lúc mount thay vì server truyền xuống, vì GET :slug (server-side,
// Next.js Server Component gọi) đang @Cacheable dùng CHUNG cho mọi user — không thể nhét trạng thái
// riêng theo user vào response đó (sẽ lộ/lẫn giữa các user, xem bookmarks.service.ts comment đầu file).
export function BookmarkButton({ postId }: { postId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<BookmarkStatus>(`/posts/${postId}/bookmark-status`)
      .then((res) => setBookmarked(res.bookmarked))
      .catch(() => {});
  }, [postId]);

  async function handleClick() {
    if (!user) {
      router.push("/dang-nhap");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<BookmarkStatus>(`/posts/${postId}/bookmark`, {
        method: "POST",
      });
      setBookmarked(res.bookmarked);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title={bookmarked ? "Bỏ lưu bài viết" : "Lưu bài viết"}
      aria-label={bookmarked ? "Bỏ lưu bài viết" : "Lưu bài viết"}
      className={`flex flex-none items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        bookmarked
          ? "border-[#1d3557] bg-[#1d3557] text-white"
          : "border-zinc-300 text-zinc-600 hover:border-[#1d3557] hover:text-[#1d3557]"
      }`}
    >
      <Bookmark size={14} strokeWidth={2} fill={bookmarked ? "currentColor" : "none"} aria-hidden />
      {bookmarked ? "Đã lưu" : "Lưu"}
    </button>
  );
}
