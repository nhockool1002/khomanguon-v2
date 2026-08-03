"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import type { Profile, ProfileMessage, ProfileMessageListResponse } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";
import { StyledUserName } from "@/components/styled-user-name";

const MODERATOR_ROLES = ["admin", "super-moderator", "moderator"];

// Lời nhắn công khai kiểu guestbook trên trang profile — bất kỳ user đăng nhập nào cũng để lại
// được, xoá được bởi chính tác giả/chủ profile/Moderator+ (giống comment-section.tsx).
export function ProfileMessages({ profileUserId }: { profileUserId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<ProfileMessage[] | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<ProfileMessageListResponse>(`/users/${profileUserId}/messages?limit=50`)
      .then((res) => setItems(res.items))
      .catch(() => setItems([]));
  }, [profileUserId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    apiFetch<Profile>("/users/me")
      .then((p) => setIsModerator(p.roles.some((r) => MODERATOR_ROLES.includes(r))))
      .catch(() => setIsModerator(false));
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/users/${profileUserId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setContent("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(messageId: string) {
    if (!confirm("Xoá lời nhắn này?")) return;
    setError(null);
    try {
      await apiFetch(`/users/${profileUserId}/messages/${messageId}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">
        Lời nhắn {items ? `(${items.length})` : ""}
      </h2>

      <ErrorBanner message={error} />

      {user ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Để lại lời nhắn..."
            rows={2}
            maxLength={500}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          />
          <div>
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
            >
              Gửi lời nhắn
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-zinc-500">
          <Link href="/dang-nhap" className="font-medium text-[#1d3557] hover:underline">
            Đăng nhập
          </Link>{" "}
          để để lại lời nhắn.
        </p>
      )}

      {items === null && <p className="text-xs text-zinc-400">Đang tải...</p>}
      {items && items.length === 0 && (
        <p className="text-sm text-zinc-400">Chưa có lời nhắn nào.</p>
      )}

      <div className="flex flex-col gap-3">
        {items?.map((m) => {
          const canDelete = user?.id === m.author.id || user?.id === profileUserId || isModerator;
          return (
            <div key={m.id} className="rounded-md border border-zinc-200 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-mono text-xs text-[#5c6370]">
                  <StyledUserName
                    styleRoleSlug={m.author.styleRoleSlug}
                    userId={m.author.id}
                    className="font-medium text-zinc-700"
                  >
                    {m.author.displayName}
                  </StyledUserName>
                  <span>·</span>
                  <span>{new Date(m.createdAt).toLocaleString("vi-VN")}</span>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Xoá
                  </button>
                )}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-zinc-800">{m.content}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
