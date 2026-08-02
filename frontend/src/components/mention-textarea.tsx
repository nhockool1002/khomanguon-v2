"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { UserSearchResult } from "@/lib/types";

const DEFAULT_CLASSNAME =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]";

// Textarea gõ "@" hiện dropdown gợi ý user (GET /users/search) — chọn xong chèn token
// "@[Tên hiển thị](userId)" vào đúng vị trí đang gõ dở. Backend chỉ tạo thông báo mention khi
// khớp đúng token này (xem comments.service.ts MENTION_PATTERN) — gõ "@" tay không kích hoạt gì.
export function MentionTextarea({
  value,
  onChange,
  onFocus,
  placeholder,
  rows = 3,
  maxLength = 2000,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  autoFocus?: boolean;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [tokenStart, setTokenStart] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);

  useEffect(() => {
    if (query === null) return;
    const handle = setTimeout(() => {
      apiFetch<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(query)}`)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onChange(next);
    const cursor = e.target.selectionStart;
    const upToCursor = next.slice(0, cursor);
    const match = upToCursor.match(/@([\p{L}0-9_ ]{0,30})$/u);
    if (match) {
      setTokenStart(cursor - match[0].length);
      setQuery(match[1]);
    } else {
      setSuggestions([]);
      setTokenStart(null);
      setQuery(null);
    }
  }

  function selectUser(user: UserSearchResult) {
    if (tokenStart === null) return;
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? value.length;
    const before = value.slice(0, tokenStart);
    const after = value.slice(cursor);
    const insertion = `@[${user.displayName}](${user.id}) `;
    onChange(`${before}${insertion}${after}`);
    setTokenStart(null);
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = before.length + insertion.length;
      textarea?.focus();
      textarea?.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onFocus={onFocus}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        autoFocus={autoFocus}
        className={className ?? DEFAULT_CLASSNAME}
      />
      {query !== null && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-64 max-w-full overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg">
          {suggestions.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => selectUser(u)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50"
            >
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#2b3f5c] text-[10px] uppercase text-white">
                {u.displayName.charAt(0)}
              </span>
              {u.displayName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
