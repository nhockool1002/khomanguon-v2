"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { PERMISSIONS } from "@/lib/permissions";
import type { DownloadLinkPublic } from "@/lib/types";
import { formatFileSize } from "@/lib/format";
import { StyledUserName } from "@/components/styled-user-name";

// Khối "TẢI VỀ SIÊU TỐC" dưới nội dung bài viết — giữ đúng nội dung/bố cục bản v1 (Cloud Storage +
// @Cash + danh sách member đã tải), style lại theo design system v2 (gradient hồng-vàng kế thừa từ
// GradientUnderline thay vì gradient tím-lục của theme WP cũ). Hỗ trợ NHIỀU link/bài (đổi thiết kế —
// trước đây chỉ 1 link "chính"/bài) — mỗi link là 1 DownloadLinkRow độc lập (unlock/báo lỗi riêng).
export function DownloadBox({ postId }: { postId: string }) {
  const [links, setLinks] = useState<DownloadLinkPublic[] | undefined>(undefined);

  useEffect(() => {
    apiFetch<DownloadLinkPublic[]>(`/posts/${postId}/download-links`)
      .then(setLinks)
      .catch(() => setLinks([]));
  }, [postId]);

  if (links === undefined) return null; // đang tải — chưa biết có cấu hình hay không, tránh nháy khung

  // Bài viết chưa cấu hình link tải nào — vẫn hiện khung (viền động y hệt), chỉ đổi nội dung sang
  // trạng thái "đang chuẩn bị" thay vì ẩn hẳn cả khối.
  if (links.length === 0) {
    return (
      <DownloadBoxShell>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <DownloadBoxIntro />
          <div className="flex flex-col items-end gap-1 rounded-lg bg-[#1d3557] px-4 py-2 text-white">
            <span className="text-[10px] uppercase tracking-wide text-zinc-300">Chi phí mở khoá</span>
            <span className="font-mono text-lg font-bold">—</span>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-zinc-100 text-lg" aria-hidden>
            ⏳
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[10px] uppercase tracking-wide text-zinc-400">Thông tin file</span>
            <span className="text-sm font-medium text-zinc-800">Đang được chuẩn bị</span>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400">Member đã tải</p>
          <p className="mt-1 text-sm text-zinc-400">Chưa có member nào tải file này.</p>
        </div>

        <button
          type="button"
          disabled
          className="rounded-lg bg-red-100 px-5 py-3 text-center text-sm font-semibold text-red-500 opacity-80"
        >
          ⏳ Liên kết tải và số @Cash đang được chuẩn bị.
        </button>
      </DownloadBoxShell>
    );
  }

  return (
    <DownloadBoxShell>
      <DownloadBoxIntro />
      {links.map((link) => (
        <DownloadLinkRow key={link.id} link={link} />
      ))}
    </DownloadBoxShell>
  );
}

function DownloadLinkRow({ link }: { link: DownloadLinkPublic }) {
  const { user } = useAuth();
  const router = useRouter();
  const [unlocking, setUnlocking] = useState(false);
  const [bypassing, setBypassing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportNote, setReportNote] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Không giữ lại link tải sau khi mở khoá — nút luôn trở về trạng thái khoá ngay sau khi mở tab
  // tải, bấm lại lần nữa tính như 1 lượt mở khoá mới (trừ $P mới), khớp đúng "mỗi lần tải trừ $P"
  // (không phải trả 1 lần dùng mãi mãi trong cùng phiên xem trang).
  async function handleUnlock() {
    if (!user) {
      router.push("/dang-nhap");
      return;
    }
    setError(null);
    setUnlocking(true);
    try {
      const res = await apiFetch<{ url: string }>(`/download-links/${link.id}/unlock`, {
        method: "POST",
      });
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setUnlocking(false);
    }
  }

  // Nút ẩn "Admin Get Presigned Link" — chỉ render khi user có quyền download.bypass (xem điều kiện
  // hiện nút bên dưới). Gọi endpoint riêng /admin-bypass thay vì /unlock, không trừ $P/không ghi
  // lịch sử (xem download-links.service.ts adminBypassUnlock).
  async function handleAdminBypass() {
    setError(null);
    setBypassing(true);
    try {
      const res = await apiFetch<{ url: string }>(`/download-links/${link.id}/admin-bypass`, {
        method: "POST",
      });
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setBypassing(false);
    }
  }

  // Báo lỗi link die (UC25) — chỉ user đã đăng nhập mới báo được (cần reporterId để Admin xử lý
  // xong còn gửi email xác nhận lại đúng người). Disable nút sau khi gửi thành công trong phiên
  // xem trang để tránh spam nhiều báo cáo trùng.
  async function handleReport(e: React.FormEvent) {
    e.preventDefault();
    setReportError(null);
    setReporting(true);
    try {
      await apiFetch("/link-reports", {
        method: "POST",
        body: JSON.stringify({ downloadLinkId: link.id, note: reportNote || undefined }),
      });
      setReportSent(true);
      setReportOpen(false);
    } catch (err) {
      setReportError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setReporting(false);
    }
  }

  const fileName = link.objectKey.split("/").pop() || link.label;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-zinc-100 text-lg" aria-hidden>
            📦
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-zinc-800">{fileName}</span>
            <span className="text-xs text-zinc-400">{formatFileSize(link.sizeBytes)}</span>
          </div>
        </div>
        <span className="flex-none rounded-full bg-[#1d3557] px-3 py-1 font-mono text-xs font-bold text-white">
          {link.priceP > 0 ? `${link.priceP} $P` : "Miễn phí"}
        </span>
      </div>

      <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-zinc-400">Member đã tải</p>
        {link.downloaders.length === 0 ? (
          <p className="mt-1 text-xs text-zinc-400">Chưa có member nào tải file này.</p>
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
      ) : (
        <button
          type="button"
          onClick={handleUnlock}
          disabled={unlocking}
          className="download-box-cta rounded-lg px-5 py-3 text-center text-sm font-semibold text-white shadow-sm disabled:opacity-50"
        >
          {unlocking
            ? "Đang xử lý..."
            : link.priceP > 0
              ? `🔒 Mở khoá & tải xuống — ${link.priceP} $P`
              : "⬇ Tải xuống miễn phí"}
        </button>
      )}

      {/* Nút ẩn "Admin Get Presigned Link" — chỉ user có quyền download.bypass mới thấy (Admin mặc
          định, role khác phải được cấp riêng qua trang Phân quyền). Không trừ $P, không ghi lịch
          sử, cố tình để nhỏ/không nổi bật để tránh nhầm với nút tải công khai bên trên. */}
      {user?.permissionKeys?.includes(PERMISSIONS.DOWNLOAD_BYPASS) && (
        <button
          type="button"
          onClick={handleAdminBypass}
          disabled={bypassing}
          title="Admin: tạo link tải không trừ $P, không ghi lịch sử"
          className="w-fit text-[11px] font-medium text-zinc-300 hover:text-zinc-500 hover:underline disabled:opacity-50"
        >
          {bypassing ? "Đang tạo link..." : "🔑 Admin Get Presigned Link"}
        </button>
      )}

      {user && (
        <div className="flex flex-col gap-2">
          {reportSent ? (
            <p className="text-center text-xs text-emerald-600">
              Đã gửi báo cáo, cảm ơn bạn! Admin sẽ xử lý sớm.
            </p>
          ) : reportOpen ? (
            <form onSubmit={handleReport} className="flex flex-col gap-2">
              <textarea
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Mô tả lỗi (tuỳ chọn) — vd: link die, tải chậm, sai file..."
                className="rounded-md border border-zinc-300 px-3 py-2 text-xs outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
              />
              {reportError && <p className="text-xs text-red-600">{reportError}</p>}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={reporting}
                  className="rounded-md bg-[#1d3557] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {reporting ? "Đang gửi..." : "Gửi báo cáo"}
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
                >
                  Huỷ
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="w-fit text-xs font-medium text-zinc-400 hover:text-zinc-600 hover:underline"
            >
              🔗 Báo lỗi link
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DownloadBoxShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="download-box-border rounded-xl p-[2px]">
      <div className="flex flex-col gap-4 rounded-[calc(0.75rem-2px)] bg-gradient-to-br from-[#fff8ec] to-white p-5">
        {children}
      </div>
    </div>
  );
}

function DownloadBoxIntro() {
  return (
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
  );
}
