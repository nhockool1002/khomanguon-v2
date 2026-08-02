"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import type { Comment, Profile } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { renderMentionText } from "@/lib/mentions";
import { ErrorBanner } from "@/components/ui";
import { MentionTextarea } from "@/components/mention-textarea";
import { StyledUserName } from "@/components/styled-user-name";

const MODERATOR_ROLES = ["admin", "super-moderator", "moderator"];

interface CommentNode extends Comment {
  replies: CommentNode[];
}

function buildTree(comments: Comment[]): CommentNode[] {
  const byParent = new Map<string, Comment[]>();
  for (const c of comments) {
    const key = c.parentId ?? "";
    byParent.set(key, [...(byParent.get(key) ?? []), c]);
  }
  const attach = (parentId: string | null): CommentNode[] =>
    (byParent.get(parentId ?? "") ?? []).map((c) => ({ ...c, replies: attach(c.id) }));
  return attach(null);
}

export function CommentSection({
  postId,
  sortOrder,
  filterUserId,
}: {
  postId: string;
  sortOrder?: "newest" | "oldest";
  filterUserId?: string;
}) {
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(true);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loadingComments, setLoadingComments] = useState(true);
  const [isModerator, setIsModerator] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Mặc định lấy từ config widget (Admin đặt ở /quan-tri/widget) — người xem có thể tự đổi lại.
  const [activeSort, setActiveSort] = useState<"newest" | "oldest">(
    sortOrder === "oldest" ? "oldest" : "newest",
  );

  async function fetchComments(): Promise<{ moderator: boolean; comments: Comment[] }> {
    let moderator = false;
    if (user) {
      try {
        const profile = await apiFetch<Profile>("/users/me");
        moderator = profile.roles.some((r) => MODERATOR_ROLES.includes(r));
      } catch {
        moderator = false;
      }
    }
    const params = new URLSearchParams({ postId, sort: activeSort });
    if (filterUserId) params.set("authorId", filterUserId);
    const path = moderator
      ? `/comments/moderation?${params.toString()}`
      : `/comments?${params.toString()}`;
    const comments = await apiFetch<Comment[]>(path);
    return { moderator, comments };
  }

  async function load() {
    try {
      const { moderator, comments } = await fetchComments();
      setIsModerator(moderator);
      setComments(comments);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoadingComments(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    fetchComments()
      .then(({ moderator, comments }) => {
        setIsModerator(moderator);
        setComments(comments);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"))
      .finally(() => setLoadingComments(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, activeSort]);

  const tree = useMemo(() => buildTree(comments ?? []), [comments]);

  async function handleSubmit(e: React.FormEvent, parentId: string | null) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/comments", {
        method: "POST",
        body: JSON.stringify({ postId, content, parentId: parentId ?? undefined }),
      });
      setContent("");
      setReplyingTo(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLike(commentId: string) {
    if (!user) return;
    try {
      await apiFetch(`/comments/${commentId}/like`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleModerate(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900"
        >
          <span>
            Bình luận {comments ? `(${comments.length})` : ""}
          </span>
          <span className="text-xs font-normal text-zinc-400">{open ? "▲ Ẩn" : "▼ Hiện"}</span>
        </button>
        {open && (
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            Sắp xếp
            <select
              value={activeSort}
              onChange={(e) => {
                setLoadingComments(true);
                setActiveSort(e.target.value as "newest" | "oldest");
              }}
              disabled={loadingComments}
              className="rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs text-zinc-700 outline-none focus:border-[#1d3557] disabled:opacity-50"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
            </select>
          </label>
        )}
      </div>

      {open && (
        <>
      <ErrorBanner message={error} />

      {user ? (
        <form onSubmit={(e) => handleSubmit(e, null)} className="flex flex-col gap-2">
          <MentionTextarea
            value={replyingTo === null ? content : ""}
            onChange={setContent}
            onFocus={() => setReplyingTo(null)}
            placeholder="Viết bình luận... (gõ @ để nhắc user)"
            rows={3}
            maxLength={2000}
          />
          <div>
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
            >
              Gửi bình luận
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-zinc-500">
          <Link href="/dang-nhap" className="font-medium text-[#1d3557] hover:underline">
            Đăng nhập
          </Link>{" "}
          để bình luận.
        </p>
      )}

      {comments === null && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <span className="text-xs text-zinc-400">Đang tải bình luận...</span>
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-zinc-100" />
          ))}
        </div>
      )}

      {tree.length === 0 && comments && (
        <p className="text-sm text-zinc-400">Chưa có bình luận nào.</p>
      )}

      {/* Giới hạn chiều cao danh sách bình luận — sidebar hẹp, cuộn riêng bên trong thay vì kéo dài
          cả cột widget, giữ ô viết bình luận ở trên luôn nhìn thấy được. */}
      <div className="flex max-h-[520px] flex-col gap-3 overflow-y-auto pr-1">
        {tree.map((node) => (
          <CommentItem
            key={node.id}
            node={node}
            depth={0}
            currentUserId={user?.id}
            isModerator={isModerator}
            replyingTo={replyingTo}
            replyContent={content}
            submitting={submitting}
            onStartReply={(id) => {
              setReplyingTo(id);
              setContent("");
            }}
            onCancelReply={() => setReplyingTo(null)}
            onReplyContentChange={setContent}
            onSubmitReply={(e) => handleSubmit(e, replyingTo)}
            onLike={handleLike}
            onHide={(id) =>
              handleModerate(() =>
                apiFetch(`/comments/${id}/status`, {
                  method: "PATCH",
                  body: JSON.stringify({ status: "HIDDEN" }),
                }),
              )
            }
            onShow={(id) =>
              handleModerate(() =>
                apiFetch(`/comments/${id}/status`, {
                  method: "PATCH",
                  body: JSON.stringify({ status: "PUBLISHED" }),
                }),
              )
            }
            onPin={(id, pinned) =>
              handleModerate(() =>
                apiFetch(`/comments/${id}/pin`, {
                  method: "PATCH",
                  body: JSON.stringify({ pinned }),
                }),
              )
            }
            onDelete={(id) => {
              if (!confirm("Xoá bình luận này? Các trả lời bên trong cũng sẽ bị xoá.")) return;
              handleModerate(() => apiFetch(`/comments/${id}`, { method: "DELETE" }));
            }}
            onBlockUser={(userId, displayName) => {
              if (!confirm(`Chặn tài khoản "${displayName}"? Họ sẽ không đăng nhập được nữa.`))
                return;
              handleModerate(() =>
                apiFetch(`/users/${userId}/status`, {
                  method: "PATCH",
                  body: JSON.stringify({ status: "BANNED" }),
                }),
              );
            }}
          />
        ))}
      </div>
        </>
      )}
    </section>
  );
}

function CommentItem({
  node,
  depth,
  currentUserId,
  isModerator,
  replyingTo,
  replyContent,
  submitting,
  onStartReply,
  onCancelReply,
  onReplyContentChange,
  onSubmitReply,
  onLike,
  onHide,
  onShow,
  onPin,
  onDelete,
  onBlockUser,
}: {
  node: CommentNode;
  depth: number;
  currentUserId?: string;
  isModerator: boolean;
  replyingTo: string | null;
  replyContent: string;
  submitting: boolean;
  onStartReply: (id: string) => void;
  onCancelReply: () => void;
  onReplyContentChange: (value: string) => void;
  onSubmitReply: (e: React.FormEvent) => void;
  onLike: (id: string) => void;
  onHide: (id: string) => void;
  onShow: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
  onBlockUser: (userId: string, displayName: string) => void;
}) {
  const isReplying = replyingTo === node.id;

  return (
    <div style={{ marginLeft: Math.min(depth, 4) * 24 }} className="flex flex-col gap-2">
      <div
        className={`rounded-md border p-3 text-sm ${
          node.status === "HIDDEN"
            ? "border-red-200 bg-red-50"
            : node.status === "PENDING"
              ? "border-amber-200 bg-amber-50"
              : "border-zinc-200 bg-white"
        }`}
      >
        <div className="flex items-center gap-2 font-mono text-xs text-[#5c6370]">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2b3f5c] text-[10px] uppercase text-white">
            {node.user.displayName.charAt(0)}
          </span>
          <StyledUserName styleRoleSlug={node.user.styleRoleSlug} className="font-medium text-zinc-700">
            {node.user.displayName}
          </StyledUserName>
          <span>·</span>
          <span>{formatDate(node.createdAt)}</span>
          {node.pinned && (
            <span className="rounded-full bg-[#1d3557] px-2 py-0.5 text-white">Đã ghim</span>
          )}
          {node.status !== "PUBLISHED" && (
            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-zinc-600">
              {node.status === "HIDDEN" ? "Đã ẩn" : "Chờ duyệt"}
            </span>
          )}
        </div>
        <p className="mt-1.5 whitespace-pre-wrap text-zinc-800">{renderMentionText(node.content)}</p>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => onLike(node.id)}
            disabled={!currentUserId}
            className={`font-medium disabled:opacity-40 ${
              node.likedByMe ? "text-[#ff5da2]" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {node.likedByMe ? "♥" : "♡"} Thích {node.likeCount > 0 && `(${node.likeCount})`}
          </button>
          {currentUserId && (
            <button
              type="button"
              onClick={() => onStartReply(node.id)}
              className="font-medium text-zinc-500 hover:text-zinc-700"
            >
              Trả lời
            </button>
          )}
          {isModerator && (
            <>
              <span className="text-zinc-300">|</span>
              {node.status === "PUBLISHED" ? (
                <button
                  type="button"
                  onClick={() => onHide(node.id)}
                  className="font-medium text-amber-600 hover:underline"
                >
                  Ẩn
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onShow(node.id)}
                  className="font-medium text-emerald-600 hover:underline"
                >
                  Hiện
                </button>
              )}
              <button
                type="button"
                onClick={() => onPin(node.id, !node.pinned)}
                className="font-medium text-[#1d3557] hover:underline"
              >
                {node.pinned ? "Bỏ ghim" : "Ghim"}
              </button>
              <button
                type="button"
                onClick={() => onDelete(node.id)}
                className="font-medium text-red-600 hover:underline"
              >
                Xoá
              </button>
              <button
                type="button"
                onClick={() => onBlockUser(node.user.id, node.user.displayName)}
                className="font-medium text-red-600 hover:underline"
              >
                Chặn user
              </button>
            </>
          )}
        </div>
      </div>

      {isReplying && (
        <form onSubmit={onSubmitReply} className="flex flex-col gap-2 pl-4">
          <MentionTextarea
            value={replyContent}
            onChange={onReplyContentChange}
            placeholder={`Trả lời ${node.user.displayName}... (gõ @ để nhắc user)`}
            rows={2}
            maxLength={2000}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !replyContent.trim()}
              className="rounded-md bg-[#1d3557] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
            >
              Gửi trả lời
            </button>
            <button
              type="button"
              onClick={onCancelReply}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Huỷ
            </button>
          </div>
        </form>
      )}

      {node.replies.map((reply) => (
        <CommentItem
          key={reply.id}
          node={reply}
          depth={depth + 1}
          currentUserId={currentUserId}
          isModerator={isModerator}
          replyingTo={replyingTo}
          replyContent={replyContent}
          submitting={submitting}
          onStartReply={onStartReply}
          onCancelReply={onCancelReply}
          onReplyContentChange={onReplyContentChange}
          onSubmitReply={onSubmitReply}
          onLike={onLike}
          onHide={onHide}
          onShow={onShow}
          onPin={onPin}
          onDelete={onDelete}
          onBlockUser={onBlockUser}
        />
      ))}
    </div>
  );
}
