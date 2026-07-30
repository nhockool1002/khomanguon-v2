"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import type { Permission, Role } from "@/lib/types";
import { ErrorBanner, SuccessBanner } from "@/components/ui";

const MODULE_LABELS: Record<string, string> = {
  post: "Bài viết",
  menu: "Menu",
  user: "Người dùng",
  role: "Vai trò",
  comment: "Bình luận",
  wallet: "Ví & Thanh toán",
  download: "Tải xuống",
  settings: "Cài đặt hệ thống",
};

const PERMISSION_LABELS: Record<string, string> = {
  "post.create": "Tạo bài viết",
  "post.edit.own": "Sửa bài viết của mình",
  "post.edit.any": "Sửa bài viết bất kỳ",
  "post.publish": "Xuất bản bài viết",
  "post.delete": "Xoá bài viết",
  "menu.manage": "Quản lý menu",
  "comment.create": "Viết bình luận",
  "comment.moderate": "Kiểm duyệt bình luận",
  "user.manage": "Quản lý người dùng",
  "user.assign_role": "Gán vai trò",
  "role.manage": "Quản lý vai trò/quyền",
  "wallet.view.own": "Xem ví của mình",
  "wallet.view.any": "Xem ví bất kỳ",
  "wallet.adjust": "Điều chỉnh ví thủ công",
  "download.manage_links": "Quản lý link tải",
  "download.purchase": "Mua link tải",
  "settings.seo": "Cài đặt SEO",
  "settings.storage_keys": "Cài đặt khoá lưu trữ",
  "settings.payment": "Cài đặt thanh toán",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "#dc2626",
  "super-moderator": "#7c3aed",
  moderator: "#2563eb",
  member: "#16a34a",
};

function groupByModule(permissions: Permission[]): [string, Permission[]][] {
  const groups = new Map<string, Permission[]>();
  for (const p of permissions) {
    const moduleKey = p.key.split(".")[0];
    groups.set(moduleKey, [...(groups.get(moduleKey) ?? []), p]);
  }
  return [...groups.entries()];
}

export default function AdminRolesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [permissions, setPermissions] = useState<Permission[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([apiFetch<Role[]>("/roles"), apiFetch<Permission[]>("/permissions")])
      .then(([r, p]) => {
        setRoles(r);
        setPermissions(p);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [user]);

  async function reload() {
    try {
      const r = await apiFetch<Role[]>("/roles");
      setRoles(r);
      return r;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
      return null;
    }
  }

  function selectRole(role: Role) {
    setSelectedId(role.id);
    setName(role.name);
    setSelectedKeys(new Set(role.permissionKeys));
    setMessage(null);
    setError(null);
  }

  function startNewRole() {
    setSelectedId("new");
    setName("");
    setSelectedKeys(new Set());
    setMessage(null);
    setError(null);
  }

  function togglePermission(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Tên vai trò không được để trống");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = { name, permissionKeys: [...selectedKeys] };
      if (selectedId === "new") {
        const created = await apiFetch<Role>("/roles", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        await reload();
        setSelectedId(created.id);
      } else if (selectedId) {
        await apiFetch<Role>(`/roles/${selectedId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        await reload();
      }
      setMessage("Đã lưu quyền.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(role: Role) {
    if (!confirm(`Xoá vai trò "${role.name}"?`)) return;
    setError(null);
    try {
      await apiFetch(`/roles/${role.id}`, { method: "DELETE" });
      if (selectedId === role.id) setSelectedId(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  const groups = useMemo(() => groupByModule(permissions ?? []), [permissions]);
  const selectedRole =
    selectedId && selectedId !== "new" ? (roles?.find((r) => r.id === selectedId) ?? null) : null;

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }

  return (
    <div className="flex w-full flex-col gap-4 px-8 py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Phân quyền</h1>

      <ErrorBanner message={error} />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex w-full flex-col gap-1 lg:w-56 lg:flex-none">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Danh sách vai trò
          </p>
          {roles?.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => selectRole(role)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                selectedId === role.id
                  ? "bg-[#1d3557] text-white"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <span
                className="h-2 w-2 flex-none rounded-full"
                style={{ backgroundColor: ROLE_COLORS[role.slug] ?? "#a1a1aa" }}
              />
              {role.name}
            </button>
          ))}
          <button
            type="button"
            onClick={startNewRole}
            className="mt-2 rounded-md px-3 py-2 text-left text-sm font-medium text-[#1d3557] hover:bg-zinc-100"
          >
            + Tạo role tuỳ chỉnh
          </button>
        </div>

        {selectedId && (
          <div className="flex flex-1 flex-col gap-4">
            <SuccessBanner message={message} />
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm text-zinc-700">
                Tên vai trò
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={selectedRole?.isSystem}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557] disabled:bg-zinc-100"
                />
              </label>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Lưu quyền"}
              </button>
              {selectedRole && !selectedRole.isSystem && (
                <button
                  type="button"
                  onClick={() => handleDelete(selectedRole)}
                  className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Xoá vai trò
                </button>
              )}
            </div>

            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Ma trận quyền
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {groups.map(([moduleKey, perms]) => (
                <div key={moduleKey} className="rounded-md border border-zinc-200 p-3">
                  <p className="mb-2 font-mono text-xs font-semibold text-zinc-700">
                    {MODULE_LABELS[moduleKey] ?? moduleKey}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {perms.map((p) => (
                      <label
                        key={p.key}
                        className="flex items-center gap-2 text-sm text-zinc-600"
                      >
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(p.key)}
                          onChange={() => togglePermission(p.key)}
                        />
                        {PERMISSION_LABELS[p.key] ?? p.key}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
