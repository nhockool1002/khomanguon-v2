"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import type { PostListResponse, PostSummary } from "@/lib/types";
import { Tooltip } from "@/components/ui";

const FIRST_DELAY_MS = 20_000; // chờ 1 chút sau khi vào trang mới hiện lần đầu, tránh làm phiền ngay
const VISIBLE_MS = 16_000; // tự ẩn nếu user không tương tác
const COOLDOWN_MS = 90_000; // khoảng nghỉ giữa 2 lần hiện

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Popup gợi ý bài viết ngẫu nhiên góc phải-dưới màn hình — bốc ngẫu nhiên không lặp lại cho tới khi
// hết danh sách rồi mới xáo lại (shuffle), thay vì Math.random() thuần dễ trúng lại bài vừa hiện.
// User đăng nhập tắt được ở trang Tài khoản (showPostPopup); khách vãng lai luôn bật, chỉ đóng được
// từng lượt (nút X) chứ không có nơi lưu tuỳ chọn vĩnh viễn.
export function PostPopup() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [pool, setPool] = useState<PostSummary[] | null>(null);
  const [current, setCurrent] = useState<PostSummary | null>(null);
  const [visible, setVisible] = useState(false);
  const queueRef = useRef<PostSummary[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Không hiện trong khu quản trị — gợi ý bài viết chỉ có ý nghĩa ở phần công khai, hiện ở
  // /admin/* chỉ gây rối khi Admin/Mod đang thao tác.
  const inAdmin = pathname?.startsWith("/admin") ?? false;
  const enabled = !inAdmin && !loading && user?.showPostPopup !== false;

  useEffect(() => {
    if (!enabled || pool !== null) return;
    apiFetch<PostListResponse>("/posts?limit=20&sort=newest")
      .then((res) => setPool(res.items))
      .catch(() => setPool([]));
  }, [enabled, pool]);

  useEffect(() => {
    if (!enabled || !pool || pool.length === 0) return;

    function scheduleNext(delay: number) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(showNext, delay);
    }

    function showNext() {
      if (queueRef.current.length === 0) queueRef.current = shuffle(pool!);
      const next = queueRef.current.shift() ?? null;
      setCurrent(next);
      setVisible(true);
      scheduleNext(VISIBLE_MS + COOLDOWN_MS);
    }

    scheduleNext(FIRST_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, pool]);

  // Ẩn tự động sau VISIBLE_MS kể từ lúc hiện (không huỷ lịch hiện lần tiếp theo — chỉ ẩn card).
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(t);
  }, [visible]);

  if (!enabled || !visible || !current) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-40 w-72 animate-[post-popup-in_0.35s_ease-out] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl"
      role="complementary"
      aria-label="Gợi ý bài viết"
    >
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Đóng gợi ý"
        className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-zinc-500 shadow hover:bg-white hover:text-zinc-800"
      >
        <X size={14} strokeWidth={2} aria-hidden />
      </button>
      <Link href={`/bai-viet/${current.slug}`} className="flex flex-col" onClick={() => setVisible(false)}>
        <div className="flex h-32 items-center justify-center overflow-hidden bg-zinc-100">
          {current.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.thumbnailUrl} alt={current.title} className="h-full w-full object-cover" />
          ) : (
            <span className="font-mono text-xs text-zinc-400">khomanguon</span>
          )}
        </div>
        <div className="flex flex-col gap-1 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#ff5da2]">
            Có thể bạn quan tâm
          </p>
          <Tooltip
            as="h4"
            content={current.title}
            className="line-clamp-2 text-sm font-semibold text-zinc-900"
          >
            {current.title}
          </Tooltip>
        </div>
      </Link>
    </div>
  );
}
