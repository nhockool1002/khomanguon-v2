"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { UserSearchResult, Widget, WidgetType } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";
import { WidgetListEditor, WIDGET_TYPE_LABEL } from "@/components/widget-list-editor";
import { DEFAULT_ROLE_OPTIONS } from "@/components/menu-tree-editor";

const WIDGET_TYPES: WidgetType[] = ["SEARCH", "CATEGORIES", "RECENT_POSTS", "HTML", "COMMENTS"];

export default function AdminWidgetPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Widget[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Widget | null>(null);
  const [newType, setNewType] = useState<WidgetType>("RECENT_POSTS");

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<Widget[]>("/widgets")
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [user]);

  async function load() {
    try {
      setItems(await apiFetch<Widget[]>("/widgets"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleReorder(updates: { id: string; order: number }[]) {
    setError(null);
    try {
      await apiFetch("/widgets/reorder", { method: "PATCH", body: JSON.stringify({ items: updates }) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
      load();
    }
  }

  async function handleCreate() {
    setError(null);
    try {
      const created = await apiFetch<Widget>("/widgets", {
        method: "POST",
        body: JSON.stringify({ type: newType, title: WIDGET_TYPE_LABEL[newType] }),
      });
      await load();
      setSelected(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleDelete(widget: Widget) {
    if (!confirm(`Xoá widget "${widget.title || WIDGET_TYPE_LABEL[widget.type]}"?`)) return;
    setError(null);
    try {
      await apiFetch(`/widgets/${widget.id}`, { method: "DELETE" });
      if (selected?.id === widget.id) setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleToggleActive(widget: Widget) {
    setError(null);
    try {
      await apiFetch(`/widgets/${widget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !widget.isActive }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleSaveSelected(values: {
    title: string;
    config: Record<string, unknown>;
    roleSlugs: string[];
  }) {
    if (!selected) return;
    setError(null);
    try {
      await apiFetch(`/widgets/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
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
  if (!user.permissionKeys?.includes(PERMISSIONS.WIDGET_MANAGE)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4 px-8 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Quản lý Widget</h1>
        <div className="flex items-center gap-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as WidgetType)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          >
            {WIDGET_TYPES.map((t) => (
              <option key={t} value={t}>
                {WIDGET_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a]"
          >
            + Thêm widget
          </button>
        </div>
      </div>
      <p className="text-sm text-zinc-500">
        Kéo icon ⠿ để đổi thứ tự hiển thị trên sidebar (trang chủ + trang bài viết).
      </p>

      <ErrorBanner message={error} />

      {items && items.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Chưa có widget nào.
        </p>
      )}

      {items && items.length > 0 && (
        <WidgetListEditor
          // Remount khi tập id đổi (thêm/xoá widget) — WidgetListEditor giữ state thứ tự nội bộ
          // (useState chỉ chạy initializer 1 lần), không tự đồng bộ nếu không remount.
          key={items.map((w) => w.id).sort().join(",")}
          items={items}
          onReorder={handleReorder}
          onEdit={setSelected}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
        />
      )}

      {selected && (
        <WidgetEditPanel
          key={selected.id}
          widget={selected}
          onCancel={() => setSelected(null)}
          onSave={handleSaveSelected}
        />
      )}
    </div>
  );
}

function WidgetEditPanel({
  widget,
  onCancel,
  onSave,
}: {
  widget: Widget;
  onCancel: () => void;
  onSave: (values: { title: string; config: Record<string, unknown>; roleSlugs: string[] }) => Promise<void>;
}) {
  const [title, setTitle] = useState(widget.title);
  const [limit, setLimit] = useState(Number(widget.config.limit) || 5);
  const [html, setHtml] = useState(String(widget.config.html ?? ""));
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">(
    widget.config.sortOrder === "oldest" ? "oldest" : "newest",
  );
  const [filterUser, setFilterUser] = useState<UserSearchResult | null>(
    typeof widget.config.filterUserId === "string" && widget.config.filterUserId
      ? { id: widget.config.filterUserId, displayName: String(widget.config.filterUserName ?? "Đã chọn"), avatarUrl: null }
      : null,
  );
  const [roleSlugs, setRoleSlugs] = useState<string[]>(widget.roleSlugs);
  const [saving, setSaving] = useState(false);

  function toggleRole(slug: string) {
    setRoleSlugs((prev) => (prev.includes(slug) ? prev.filter((r) => r !== slug) : [...prev, slug]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const config: Record<string, unknown> =
        widget.type === "RECENT_POSTS"
          ? { limit }
          : widget.type === "HTML"
            ? { html }
            : widget.type === "COMMENTS"
              ? {
                  sortOrder,
                  ...(filterUser && { filterUserId: filterUser.id, filterUserName: filterUser.displayName }),
                }
              : {};
      await onSave({ title, config, roleSlugs });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Chỉnh sửa widget ({WIDGET_TYPE_LABEL[widget.type]})
      </p>

      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Tiêu đề (để trống = không hiện tiêu đề khối)
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        />
      </label>

      {widget.type === "RECENT_POSTS" && (
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Số bài viết hiển thị
          <input
            type="number"
            min={1}
            max={20}
            value={limit}
            onChange={(e) => setLimit(Math.max(1, Number(e.target.value) || 1))}
            className="w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          />
        </label>
      )}

      {widget.type === "HTML" && (
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Nội dung HTML
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            rows={6}
            className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          />
        </label>
      )}

      {widget.type === "COMMENTS" && (
        <>
          <p className="text-xs text-zinc-400">
            Chỉ hiển thị trên trang chi tiết bài viết (cần biết bài viết đang xem) — sẽ không hiện ở
            trang chủ hay các trang khác dù đang bật.
          </p>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Sắp xếp mặc định
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
              className="w-48 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
            >
              <option value="newest">Mới nhất trước</option>
              <option value="oldest">Cũ nhất trước</option>
            </select>
          </label>
          <div className="flex flex-col gap-1 text-sm text-zinc-700">
            Lọc theo user (để trống = tất cả)
            <UserPicker value={filterUser} onChange={setFilterUser} />
          </div>
        </>
      )}

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

// Ô tìm-chọn 1 user (GET /users/search) — dùng để set filterUserId cho widget Bình luận.
function UserPicker({
  value,
  onChange,
}: {
  value: UserSearchResult | null;
  onChange: (user: UserSearchResult | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);

  useEffect(() => {
    if (!query.trim()) return;
    const handle = setTimeout(() => {
      apiFetch<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(query)}`)
        .then(setResults)
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#2b3f5c] text-[10px] uppercase text-white">
          {value.displayName.charAt(0)}
        </span>
        {value.displayName}
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-auto text-xs font-medium text-red-600 hover:underline"
        >
          Bỏ chọn
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!e.target.value.trim()) setResults([]);
        }}
        placeholder="Gõ tên user..."
        className="w-64 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
      />
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-64 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onChange(u);
                setQuery("");
                setResults([]);
              }}
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
