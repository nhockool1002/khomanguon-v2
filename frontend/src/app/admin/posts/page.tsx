"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { PostListResponse, PostStatus } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { ErrorBanner, Tooltip } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

const STATUS_LABEL: Record<PostStatus, string> = {
  DRAFT: "Nháp",
  PENDING_REVIEW: "Chờ duyệt",
  PUBLISHED: "Xuất bản",
};

export default function AdminPostsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<PostListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<PostListResponse>("/posts/admin/list?limit=50")
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [user]);

  async function reload() {
    try {
      const res = await apiFetch<PostListResponse>("/posts/admin/list?limit=50");
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Xoá bài viết này? Không thể hoàn tác.")) return;
    setDeletingId(id);
    try {
      await apiFetch(`/posts/${id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.POST_CREATE)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Quản lý bài viết</h1>
        <Link
          href="/admin/posts/new"
          className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a]"
        >
          Bài viết mới
        </Link>
      </div>

      <ErrorBanner message={error} />

      {data && data.items.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Chưa có bài viết nào.
        </p>
      )}

      {data && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Tiêu đề</th>
                <th className="px-3 py-2">Tác giả</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Ngày tạo</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((post) => (
                <tr key={post.id} className="border-t border-zinc-100">
                  <Tooltip
                    as="td"
                    content={post.title}
                    className="max-w-xs truncate px-3 py-2 font-medium text-[#1d3557]"
                  >
                    {post.title}
                  </Tooltip>
                  <td className="px-3 py-2 text-zinc-600">{post.author.displayName}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600">
                      {STATUS_LABEL[post.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{formatDate(post.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    {post.status === "PUBLISHED" ? (
                      <Link
                        href={`/bai-viet/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mr-3 text-xs font-medium text-zinc-500 hover:underline"
                      >
                        Xem
                      </Link>
                    ) : (
                      <span
                        title="Chỉ xem được sau khi bài viết đã Xuất bản"
                        className="mr-3 text-xs font-medium text-zinc-300"
                      >
                        Xem
                      </span>
                    )}
                    <Link
                      href={`/admin/posts/${post.id}`}
                      className="mr-3 text-xs font-medium text-[#1d3557] hover:underline"
                    >
                      Sửa
                    </Link>
                    <button
                      onClick={() => handleDelete(post.id)}
                      disabled={deletingId === post.id}
                      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                    >
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
