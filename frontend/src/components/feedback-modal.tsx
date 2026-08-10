"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { ErrorBanner, SuccessBanner } from "@/components/ui";

const MESSAGE_MAX_LENGTH = 2000;

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]";

// Modal gửi góp ý từ bất kỳ đâu trên site — hoạt động cả khi chưa đăng nhập (POST /feedback dùng
// OptionalJwtAuthGuard ở backend). Đã đăng nhập thì khỏi hỏi lại tên/email (lấy từ tài khoản), ẩn
// danh thì cho nhập tuỳ chọn để Admin còn cách liên hệ lại. Cùng convention modal khác trong repo
// (media-picker-modal.tsx): open/onClose điều khiển hiển thị, backdrop click + Escape để đóng.
export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [syncedOpen, setSyncedOpen] = useState(open);

  // Reset form mỗi lần mở lại — không giữ nội dung/lỗi của lần gửi trước (cùng pattern
  // media-picker-modal.tsx: cập nhật ngay trong lúc render thay vì trong useEffect).
  if (open !== syncedOpen) {
    setSyncedOpen(open);
    if (open) {
      setMessage("");
      setName("");
      setEmail("");
      setError(null);
      setSuccess(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/feedback", {
        method: "POST",
        body: JSON.stringify({
          message: message.trim(),
          // Bỏ hẳn key khi để trống (không gửi "") — backend @IsOptional() chỉ bỏ qua validate
          // với undefined, chuỗi rỗng vẫn bị @IsEmail() chặn.
          name: user ? undefined : name.trim() || undefined,
          email: user ? undefined : email.trim() || undefined,
        }),
      });
      setSuccess(true);
      setMessage("");
      setName("");
      setEmail("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gửi góp ý thất bại, thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col gap-3 rounded-lg bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Gửi góp ý</h2>
            <p className="text-xs text-zinc-500">
              {user
                ? `Gửi với tư cách ${user.displayName} (${user.email}).`
                : "Bạn có thể gửi ẩn danh, hoặc để lại tên/email nếu muốn nhận phản hồi."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            ✕
          </button>
        </div>

        <ErrorBanner message={error} />
        <SuccessBanner message={success ? "Cảm ơn bạn đã góp ý! Chúng tôi đã ghi nhận." : null} />

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {!user && (
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1.5 text-sm text-zinc-700">
                Tên (tuỳ chọn)
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  placeholder="Ẩn danh"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-1 flex-col gap-1.5 text-sm text-zinc-700">
                Email (tuỳ chọn)
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Để nhận phản hồi"
                  className={inputClass}
                />
              </label>
            </div>
          )}
          <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
            Nội dung góp ý
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MESSAGE_MAX_LENGTH}
              rows={5}
              required
              placeholder="Bạn muốn góp ý điều gì về khomanguon.vn?"
              className={`${inputClass} resize-none`}
            />
            <span className="self-end text-xs text-zinc-400">
              {message.length}/{MESSAGE_MAX_LENGTH}
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
            >
              {submitting ? "Đang gửi..." : "Gửi góp ý"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
