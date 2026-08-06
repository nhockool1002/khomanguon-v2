"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export function FormField({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
      {label}
      <input
        {...props}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
      />
    </label>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      {message}
    </div>
  );
}

export function SubmitButton({
  children,
  loading,
  ...props
}: {
  children: React.ReactNode;
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#16294a] disabled:opacity-50"
    >
      {loading && <Loader2 size={15} strokeWidth={2} className="animate-spin" aria-hidden />}
      {loading ? "Đang xử lý..." : children}
    </button>
  );
}

// Tooltip tự viết thay cho title= native (độ trễ hiện/tắt do trình duyệt tự quyết, không tin cậy
// và không nhất quán giữa các trình duyệt) — dùng "as" để giữ nguyên thẻ HTML gốc (h3/td/...) nên
// không phá vỡ CSS phụ thuộc vào chính thẻ đó (line-clamp, table layout...).
export function Tooltip({
  content,
  children,
  as: Component = "span",
  className,
}: {
  content: string;
  children: React.ReactNode;
  as?: React.ElementType;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    timerRef.current = setTimeout(() => setVisible(true), 300);
  }
  function hide() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }

  return (
    <Component
      className={`relative ${className ?? ""}`}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-max max-w-xs -translate-x-1/2 rounded-md bg-zinc-900 px-2 py-1 text-xs text-white shadow-lg"
        >
          {content}
        </span>
      )}
    </Component>
  );
}

export function AuthCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-lg font-semibold text-zinc-900">{title}</h1>
        {children}
      </div>
    </div>
  );
}
