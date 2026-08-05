"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { Tag } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

export default function AdminTagsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Tag | null | "new">(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const reload = useCallback(() => {
    apiFetch<Tag[]>("/tags")
      .then(setTags)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, []);

  useEffect(() => {
    if (!user) return;
    reload();
  }, [user, reload]);

  async function handleDelete(tag: Tag) {
    if (!confirm(`Xoá tag "${tag.name}"?`)) return;
    setError(null);
    try {
      await apiFetch(`/tags/${tag.id}`, { method: "DELETE" });
      if (editing !== "new" && editing?.id === tag.id) setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleSave(values: { name: string; slug: string }) {
    setError(null);
    try {
      const payload = { name: values.name, slug: values.slug || undefined };
      if (editing === "new") {
        await apiFetch("/tags", { method: "POST", body: JSON.stringify(payload) });
      } else if (editing) {
        await apiFetch(`/tags/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      }
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.POST_PUBLISH)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4 px-8 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Quản lý Tag</h1>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a]"
        >
          + Thêm tag
        </button>
      </div>

      <ErrorBanner message={error} />

      {tags && tags.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Chưa có tag nào.
        </p>
      )}

      {tags && tags.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {tags.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2"
            >
              <div>
                <span className="text-sm font-medium text-zinc-800">{t.name}</span>
                <span className="ml-2 font-mono text-xs text-zinc-400">/{t.slug}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(t)}
                  className="rounded px-2 py-0.5 text-xs font-medium text-[#1d3557] hover:bg-zinc-100"
                >
                  Sửa
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(t)}
                  className="rounded px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-zinc-100"
                >
                  Xoá
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TagEditPanel
          key={editing === "new" ? "new" : editing.id}
          tag={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function TagEditPanel({
  tag,
  onCancel,
  onSave,
}: {
  tag: Tag | null;
  onCancel: () => void;
  onSave: (values: { name: string; slug: string }) => Promise<void>;
}) {
  const [name, setName] = useState(tag?.name ?? "");
  const [slug, setSlug] = useState(tag?.slug ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ name, slug });
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
        {tag ? "Chỉnh sửa tag" : "Tag mới"}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Tên tag
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={1}
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
