"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import type { Category } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";

interface CategoryNode extends Category {
  children: CategoryNode[];
}

function buildTree(items: Category[]): CategoryNode[] {
  const byParent = new Map<string, Category[]>();
  for (const item of items) {
    const key = item.parentId ?? "";
    byParent.set(key, [...(byParent.get(key) ?? []), item]);
  }
  const attach = (parentId: string | null): CategoryNode[] =>
    (byParent.get(parentId ?? "") ?? [])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({ ...item, children: attach(item.id) }));
  return attach(null);
}

function flatten(nodes: CategoryNode[], depth = 0): { node: CategoryNode; depth: number }[] {
  return nodes.flatMap((node) => [{ node, depth }, ...flatten(node.children, depth + 1)]);
}

// Loại bỏ chính nó + toàn bộ hậu duệ khỏi danh sách chọn "danh mục cha" khi sửa — tránh vòng lặp.
function excludeSubtree(items: Category[], excludeId: string): Category[] {
  const toRemove = new Set([excludeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of items) {
      if (item.parentId && toRemove.has(item.parentId) && !toRemove.has(item.id)) {
        toRemove.add(item.id);
        changed = true;
      }
    }
  }
  return items.filter((item) => !toRemove.has(item.id));
}

export default function AdminCategoriesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null | "new">(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<Category[]>("/categories")
      .then(setCategories)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [user]);

  async function reload() {
    try {
      const res = await apiFetch<Category[]>("/categories");
      setCategories(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleDelete(category: Category) {
    if (!confirm(`Xoá "${category.name}"? Danh mục con (nếu có) sẽ thành danh mục gốc.`)) return;
    setError(null);
    try {
      await apiFetch(`/categories/${category.id}`, { method: "DELETE" });
      if (editing !== "new" && editing?.id === category.id) setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleSave(values: { name: string; slug: string; parentId: string }) {
    setError(null);
    try {
      const payload = {
        name: values.name,
        slug: values.slug || undefined,
        parentId: values.parentId || undefined,
      };
      if (editing === "new") {
        await apiFetch("/categories", { method: "POST", body: JSON.stringify(payload) });
      } else if (editing) {
        await apiFetch(`/categories/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  const tree = useMemo(() => (categories ? buildTree(categories) : []), [categories]);
  const rows = useMemo(() => flatten(tree), [tree]);

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4 px-8 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Quản lý danh mục</h1>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a]"
        >
          + Thêm danh mục
        </button>
      </div>

      <ErrorBanner message={error} />

      {categories && categories.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Chưa có danh mục nào.
        </p>
      )}

      {rows.length > 0 && (
        <div className="flex flex-col gap-1">
          {rows.map(({ node, depth }) => (
            <div
              key={node.id}
              style={{ marginLeft: depth * 24 }}
              className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <span className="font-medium text-zinc-800">{node.name}</span>
              <span className="font-mono text-xs text-zinc-400">/{node.slug}</span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(node)}
                  className="rounded px-2 py-0.5 text-xs font-medium text-[#1d3557] hover:bg-zinc-100"
                >
                  sửa
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(node)}
                  className="rounded px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-zinc-100"
                >
                  xoá
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <CategoryEditPanel
          key={editing === "new" ? "new" : editing.id}
          category={editing === "new" ? null : editing}
          options={
            categories
              ? editing === "new"
                ? categories
                : excludeSubtree(categories, editing.id)
              : []
          }
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function CategoryEditPanel({
  category,
  options,
  onCancel,
  onSave,
}: {
  category: Category | null;
  options: Category[];
  onCancel: () => void;
  onSave: (values: { name: string; slug: string; parentId: string }) => Promise<void>;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [parentId, setParentId] = useState(category?.parentId ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ name, slug, parentId });
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
        {category ? "Chỉnh sửa danh mục" : "Danh mục mới"}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Tên danh mục
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Slug (để trống để tự sinh)
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Danh mục cha
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        >
          <option value="">— Không có (danh mục gốc) —</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
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
