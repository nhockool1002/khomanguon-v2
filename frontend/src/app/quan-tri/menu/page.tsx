"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { MenuItem } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";
import { MenuTreeEditor, DEFAULT_ROLE_OPTIONS } from "@/components/menu-tree-editor";
import { ForbiddenPage } from "@/components/forbidden-page";

export default function AdminMenuPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MenuItem | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<MenuItem[]>("/menus")
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [user]);

  async function load() {
    try {
      const res = await apiFetch<MenuItem[]>("/menus");
      setItems(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleReorder(
    updates: { id: string; parentId: string | null; order: number }[],
  ) {
    setError(null);
    try {
      await apiFetch("/menus/reorder", { method: "PATCH", body: JSON.stringify({ items: updates }) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
      load();
    }
  }

  async function handleCreate() {
    setError(null);
    try {
      const created = await apiFetch<MenuItem>("/menus", {
        method: "POST",
        body: JSON.stringify({ label: "Mục mới", url: "/" }),
      });
      await load();
      setSelected(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleDelete(item: MenuItem) {
    if (!confirm(`Xoá "${item.label}"? Các mục con (nếu có) cũng sẽ bị xoá.`)) return;
    setError(null);
    try {
      await apiFetch(`/menus/${item.id}`, { method: "DELETE" });
      if (selected?.id === item.id) setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleSaveSelected(values: {
    label: string;
    url: string;
    icon: string;
    openInNewTab: boolean;
    roleSlugs: string[];
  }) {
    if (!selected) return;
    setError(null);
    try {
      await apiFetch(`/menus/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          label: values.label,
          url: values.url,
          icon: values.icon || undefined,
          openInNewTab: values.openInNewTab,
          roleSlugs: values.roleSlugs,
        }),
      });
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.MENU_MANAGE)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4 px-8 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Quản lý menu</h1>
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a]"
        >
          + Thêm mục
        </button>
      </div>

      <ErrorBanner message={error} />

      {items && items.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Chưa có mục menu nào.
        </p>
      )}

      {items && items.length > 0 && (
        <MenuTreeEditor
          items={items}
          onReorder={handleReorder}
          onEdit={setSelected}
          onDelete={handleDelete}
        />
      )}

      {selected && (
        <MenuEditPanel
          key={selected.id}
          item={selected}
          onCancel={() => setSelected(null)}
          onSave={handleSaveSelected}
        />
      )}
    </div>
  );
}

function MenuEditPanel({
  item,
  onCancel,
  onSave,
}: {
  item: MenuItem;
  onCancel: () => void;
  onSave: (values: {
    label: string;
    url: string;
    icon: string;
    openInNewTab: boolean;
    roleSlugs: string[];
  }) => Promise<void>;
}) {
  const [label, setLabel] = useState(item.label);
  const [url, setUrl] = useState(item.url);
  const [icon, setIcon] = useState(item.icon ?? "");
  const [openInNewTab, setOpenInNewTab] = useState(item.openInNewTab);
  const [roleSlugs, setRoleSlugs] = useState<string[]>(item.roleSlugs);
  const [saving, setSaving] = useState(false);

  function toggleRole(slug: string) {
    setRoleSlugs((prev) => (prev.includes(slug) ? prev.filter((r) => r !== slug) : [...prev, slug]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ label, url, icon, openInNewTab, roleSlugs });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Chỉnh sửa mục đang chọn
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Nhãn hiển thị
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Liên kết
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Icon (emoji, tuỳ chọn)
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            maxLength={10}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          />
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={openInNewTab}
            onChange={(e) => setOpenInNewTab(e.target.checked)}
          />
          Mở tab mới
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-zinc-700">
          Hiển thị với (không chọn gì = công khai, ai cũng thấy)
        </span>
        <div className="flex flex-wrap gap-3">
          {DEFAULT_ROLE_OPTIONS.map((role) => (
            <label key={role.slug} className="flex items-center gap-1.5 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={roleSlugs.includes(role.slug)}
                onChange={() => toggleRole(role.slug)}
              />
              {role.name}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Huỷ
        </button>
      </div>
    </form>
  );
}
