"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import type { UserActivity } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";

const PAGE_SIZE = 20;

const TYPE_ICON: Record<UserActivity["type"], string> = {
  LOGIN: "🔑",
  VIEW_POST: "👁",
  DEPOSIT: "💰",
  VISIT_PROFILE: "👤",
};

function describe(activity: UserActivity): string {
  const meta = activity.metadata ?? {};
  switch (activity.type) {
    case "LOGIN":
      return "Đăng nhập vào tài khoản";
    case "VIEW_POST":
      return `Xem bài viết "${String(meta.postTitle ?? "")}"`;
    case "DEPOSIT":
      return `Nạp ${Number(meta.amountVnd ?? 0).toLocaleString("vi-VN")} VNĐ vào ví`;
    case "VISIT_PROFILE":
      return `Ghé thăm trang hồ sơ của ${String(meta.profileDisplayName ?? "")}`;
    default:
      return "";
  }
}

function activityLink(activity: UserActivity): string | null {
  const meta = activity.metadata ?? {};
  if (activity.type === "VIEW_POST" && meta.postSlug) return `/bai-viet/${String(meta.postSlug)}`;
  if (activity.type === "VISIT_PROFILE" && meta.profileUserId) return `/nguoi-dung/${String(meta.profileUserId)}`;
  return null;
}

// Tab "Hoạt động" — chỉ chính chủ xem được (GET /users/me/activity), gộp 4 loại: đăng nhập, xem bài
// viết, nạp tiền, ghé thăm profile người khác (đúng phạm vi yêu cầu, không cố log "mọi hành động").
export function ActivityTab() {
  const [items, setItems] = useState<UserActivity[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    apiFetch<{ items: UserActivity[]; total: number }>(
      `/users/me/activity?page=${page}&limit=${PAGE_SIZE}`,
    )
      .then((res) => {
        setItems((prev) => (page === 1 ? res.items : [...(prev ?? []), ...res.items]));
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [page]);

  useEffect(() => {
    reload();
  }, [reload]);

  const hasMore = (items?.length ?? 0) < total;

  return (
    <div className="flex flex-col gap-3">
      <ErrorBanner message={error} />

      {items && items.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Chưa có hoạt động nào.
        </p>
      )}

      {items && items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((activity) => {
            const href = activityLink(activity);
            const content = (
              <>
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-zinc-100 text-sm" aria-hidden>
                  {TYPE_ICON[activity.type]}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-zinc-800">{describe(activity)}</span>
                  <span className="font-mono text-xs text-zinc-400">
                    {new Date(activity.createdAt).toLocaleString("vi-VN")}
                  </span>
                </div>
              </>
            );
            return href ? (
              <Link
                key={activity.id}
                href={href}
                className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white p-3 hover:border-[#1d3557]"
              >
                {content}
              </Link>
            ) : (
              <div key={activity.id} className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white p-3">
                {content}
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="w-fit rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Tải thêm
        </button>
      )}
    </div>
  );
}
