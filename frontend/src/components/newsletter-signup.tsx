"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";

// Form đăng ký bản tin — đặt cạnh Footer (layout.tsx), hiển thị site-wide. Public, không cần đăng
// nhập (POST /newsletter/subscribe chỉ rate-limit theo IP, xem newsletter.controller.ts).
export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setError(null);
    try {
      await apiFetch("/newsletter/subscribe", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setStatus("done");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Đăng ký thất bại, thử lại sau.");
    }
  }

  if (status === "done") {
    return (
      <div className="border-t border-zinc-200 bg-zinc-50 px-6 py-4 text-center text-sm text-emerald-600">
        Đã đăng ký nhận bản tin — cảm ơn bạn!
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-200 bg-zinc-50 px-6 py-4">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-md flex-col items-center gap-2 sm:flex-row"
      >
        <label htmlFor="newsletter-email" className="sr-only">
          Email nhận bản tin
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Nhận bản tin bài viết mới hàng tuần qua email"
          className="w-full flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full flex-none rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50 sm:w-auto"
        >
          {status === "loading" ? "Đang gửi..." : "Đăng ký"}
        </button>
      </form>
      {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
