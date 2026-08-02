"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import type { AdminUser, UserStatus } from "@/lib/types";
import { ErrorBanner, SuccessBanner } from "@/components/ui";
import { DEFAULT_ROLE_OPTIONS } from "@/components/menu-tree-editor";

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: "Đang hoạt động",
  BANNED: "Đã khoá",
};

export default function AdminUsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const reload = useCallback(() => {
    apiFetch<{ items: AdminUser[]; total: number }>(`/users?page=${page}&limit=${PAGE_SIZE}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [page]);

  useEffect(() => {
    if (!user) return;
    reload();
  }, [user, reload]);

  async function toggleStatus(target: AdminUser) {
    const nextStatus: UserStatus = target.status === "ACTIVE" ? "BANNED" : "ACTIVE";
    const verb = nextStatus === "BANNED" ? "khoá" : "mở khoá";
    if (!confirm(`${verb === "khoá" ? "Khoá" : "Mở khoá"} tài khoản "${target.email}"?`)) return;
    setError(null);
    setMessage(null);
    setBusyId(target.id);
    try {
      await apiFetch(`/users/${target.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setMessage(`Đã ${verb} tài khoản ${target.email}.`);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusyId(null);
    }
  }

  async function addRole(target: AdminUser, roleSlug: string) {
    if (!roleSlug || target.roles.some((r) => r.slug === roleSlug)) return;
    setError(null);
    setBusyId(target.id);
    try {
      await apiFetch(`/users/${target.id}/roles`, {
        method: "POST",
        body: JSON.stringify({ roleSlug }),
      });
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusyId(null);
    }
  }

  async function removeRole(target: AdminUser, roleSlug: string) {
    setError(null);
    setBusyId(target.id);
    try {
      await apiFetch(`/users/${target.id}/roles/${roleSlug}`, { method: "DELETE" });
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="flex w-full flex-col gap-4 px-8 py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Quản lý User</h1>
      <p className="text-sm text-zinc-500">
        Khoá/mở khoá tài khoản, gán hoặc gỡ vai trò. Khoá tài khoản sẽ đăng xuất tất cả phiên đang
        đăng nhập của user đó.
      </p>

      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      {items && items.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Chưa có user nào.
        </p>
      )}

      {items && items.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Tên hiển thị</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Vai trò</th>
                <th className="px-3 py-2">Ngày tạo</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2 font-mono text-xs text-zinc-700">{u.email}</td>
                  <td className="px-3 py-2 text-zinc-800">{u.displayName}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {STATUS_LABEL[u.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {u.roles.map((r) => (
                        <span
                          key={r.slug}
                          className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                        >
                          {r.name}
                          <button
                            type="button"
                            onClick={() => removeRole(u, r.slug)}
                            disabled={busyId === u.id}
                            className="text-zinc-400 hover:text-red-600"
                            aria-label={`Gỡ vai trò ${r.name}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <select
                        value=""
                        onChange={(e) => addRole(u, e.target.value)}
                        disabled={busyId === u.id}
                        className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs text-zinc-500 outline-none"
                      >
                        <option value="">+ Gán vai trò</option>
                        {DEFAULT_ROLE_OPTIONS.filter(
                          (r) => !u.roles.some((ur) => ur.slug === r.slug),
                        ).map((r) => (
                          <option key={r.slug} value={r.slug}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {new Date(u.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleStatus(u)}
                      disabled={busyId === u.id}
                      className={`rounded px-2 py-0.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 ${
                        u.status === "ACTIVE" ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {u.status === "ACTIVE" ? "Khoá" : "Mở khoá"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40"
          >
            ← Trước
          </button>
          <span className="text-zinc-500">
            Trang {page}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40"
          >
            Sau →
          </button>
        </div>
      )}
    </div>
  );
}
