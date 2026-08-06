"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { AdminUser, UserStatus } from "@/lib/types";
import { ErrorBanner, SuccessBanner } from "@/components/ui";
import { DEFAULT_ROLE_OPTIONS } from "@/components/menu-tree-editor";
import { ForbiddenPage } from "@/components/forbidden-page";

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: "Đang hoạt động",
  BANNED: "Đã khoá",
};

type SortBy = "email" | "displayName" | "status" | "createdAt";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortBy; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "displayName", label: "Tên hiển thị" },
  { key: "status", label: "Trạng thái" },
  { key: "createdAt", label: "Ngày tạo" },
];

function SortArrow({ dir }: { dir: SortDir }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={dir === "asc" ? "" : "rotate-180"}
    >
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

export default function AdminUsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  // Gõ vào ô tìm kiếm không gọi API ngay — chờ 300ms sau khi ngừng gõ mới cập nhật `search` (tránh
  // spam request mỗi phím bấm), đồng thời reset về trang 1 vì tổng số kết quả đã đổi.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const reload = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      sortBy,
      sortDir,
    });
    if (search.trim()) params.set("search", search.trim());
    apiFetch<{ items: AdminUser[]; total: number }>(`/users?${params.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [page, search, sortBy, sortDir]);

  useEffect(() => {
    if (!user) return;
    reload();
  }, [user, reload]);

  function toggleSort(key: SortBy) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

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

  async function sendResetPassword(target: AdminUser) {
    if (!confirm(`Gửi email đặt lại mật khẩu cho "${target.email}"?`)) return;
    setError(null);
    setMessage(null);
    setBusyId(target.id);
    try {
      await apiFetch(`/users/${target.id}/send-reset-password`, { method: "POST" });
      setMessage(`Đã gửi email đặt lại mật khẩu tới ${target.email}.`);
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
  if (!user.permissionKeys?.includes(PERMISSIONS.USER_MANAGE)) {
    return <ForbiddenPage />;
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Quản lý User</h1>
      <p className="text-sm text-zinc-500">
        Khoá/mở khoá tài khoản, gán hoặc gỡ vai trò, gửi email đặt lại mật khẩu. Khoá tài khoản sẽ
        đăng xuất tất cả phiên đang đăng nhập của user đó.
      </p>

      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      <input
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Tìm theo email hoặc tên hiển thị..."
        className="w-full max-w-sm rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
      />

      {items && items.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          {search ? "Không tìm thấy user nào." : "Chưa có user nào."}
        </p>
      )}

      {items && items.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="flex items-center gap-1 hover:text-zinc-800"
                    >
                      {col.label}
                      {sortBy === col.key && <SortArrow dir={sortDir} />}
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2">Vai trò</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2 font-mono text-xs text-zinc-700">
                    <Link
                      href={`/nguoi-dung/${u.id}`}
                      target="_blank"
                      title="Xem trang hồ sơ công khai"
                      className="hover:text-[#1d3557] hover:underline"
                    >
                      {u.email}
                    </Link>
                  </td>
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
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {new Date(u.createdAt).toLocaleDateString("vi-VN")}
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
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => sendResetPassword(u)}
                        disabled={busyId === u.id}
                        className="rounded px-2 py-0.5 text-xs font-medium text-[#1d3557] hover:bg-zinc-100 disabled:opacity-50"
                      >
                        Đặt lại mật khẩu
                      </button>
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
                    </div>
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
