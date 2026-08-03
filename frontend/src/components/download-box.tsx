"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import type { DownloadLinkPublic } from "@/lib/types";
import { formatFileSize } from "@/lib/format";
import { StyledUserName } from "@/components/styled-user-name";

// Khối "TẢI VỀ SIÊU TỐC" dưới nội dung bài viết — giữ đúng nội dung/bố cục bản v1 (Cloud Storage +
// @Cash + danh sách member đã tải), style lại theo design system v2 (gradient hồng-vàng kế thừa từ
// GradientUnderline thay vì gradient tím-lục của theme WP cũ).
export function DownloadBox({ postId }: { postId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [link, setLink] = useState<DownloadLinkPublic | null | undefined>(undefined);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DownloadLinkPublic | null>(`/posts/${postId}/download-link`)
      .then(setLink)
      .catch(() => setLink(null));
  }, [postId]);

  async function handleUnlock() {
    if (!user) {
      router.push("/dang-nhap");
      return;
    }
    setError(null);
    setUnlocking(true);
    try {
      const res = await apiFetch<{ url: string }>(`/posts/${postId}/download-link/unlock`, {
        method: "POST",
      });
      setDownloadUrl(res.url);
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setUnlocking(false);
    }
  }

  if (!link) return null; // đang tải hoặc bài viết không có cấu hình tải — không hiện khung rỗng

  const fileName = link.objectKey.split("/").pop() || link.label;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[#ffcf3f]/40 bg-gradient-to-br from-[#fff8ec] to-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="w-fit rounded-full bg-gradient-to-r from-[#ff5da2] to-[#ffcf3f] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
            Tải về siêu tốc
          </span>
          <p className="text-base font-semibold text-zinc-900">
            Bạn có thể tải về với một liên kết duy nhất bên dưới 🚀
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-zinc-500">
            <li>➜ Liên kết tải trực tiếp, không quảng cáo.</li>
            <li>➜ Liên kết tải đơn luồng, tốc độ tải không giới hạn.</li>
          </ul>
        </div>

        <div className="flex flex-col items-end gap-1 rounded-lg bg-[#1d3557] px-4 py-2 text-white">
          <span className="text-[10px] uppercase tracking-wide text-zinc-300">Chi phí mở khoá</span>
          <span className="font-mono text-lg font-bold">
            {link.priceP > 0 ? `${link.priceP} $P` : "Miễn phí"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-zinc-100 text-lg" aria-hidden>
          📦
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[10px] uppercase tracking-wide text-zinc-400">Tên file</span>
          <span className="truncate text-sm font-medium text-zinc-800">{fileName}</span>
        </div>
        <div className="flex flex-none flex-col items-end">
          <span className="text-[10px] uppercase tracking-wide text-zinc-400">Dung lượng</span>
          <span className="text-sm font-medium text-zinc-800">{formatFileSize(link.sizeBytes)}</span>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
        <p className="text-[10px] uppercase tracking-wide text-zinc-400">Member đã tải</p>
        {link.downloaders.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-400">Chưa có member nào tải file này.</p>
        ) : (
          <p className="mt-1 text-sm text-zinc-700">
            {link.downloaders.map((d, i) => (
              <span key={d.id}>
                <StyledUserName styleRoleSlug={d.styleRoleSlug} userId={d.id}>
                  {d.displayName}
                </StyledUserName>
                {i < link.downloaders.length - 1 && ", "}
              </span>
            ))}
          </p>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {user && !user.emailVerified ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
          Tài khoản của bạn chưa xác minh email nên chưa tải file được — xác minh email ở{" "}
          <Link href="/tai-khoan" className="font-medium underline">
            trang Tài khoản
          </Link>{" "}
          trước.
        </p>
      ) : downloadUrl ? (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-gradient-to-r from-[#ff5da2] to-[#ffcf3f] px-5 py-3 text-center text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          ⬇ Tải xuống ngay
        </a>
      ) : (
        <button
          type="button"
          onClick={handleUnlock}
          disabled={unlocking}
          className="rounded-lg bg-gradient-to-r from-[#ff5da2] to-[#ffcf3f] px-5 py-3 text-center text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {unlocking
            ? "Đang xử lý..."
            : link.priceP > 0
              ? `🔒 Mở khoá & tải xuống — ${link.priceP} $P`
              : "⬇ Tải xuống miễn phí"}
        </button>
      )}
    </div>
  );
}
