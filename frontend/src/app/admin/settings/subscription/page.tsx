"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { SubscriptionPlan } from "@/lib/types";
import { ErrorBanner, SuccessBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]";

interface PlanFormState {
  name: string;
  durationDays: string;
  priceVnd: string;
  totalDownloadLimit: string; // rỗng = không giới hạn
  dailyDownloadLimit: string; // rỗng = không giới hạn
  isActive: boolean;
  order: string;
}

const EMPTY_FORM: PlanFormState = {
  name: "",
  durationDays: "",
  priceVnd: "",
  totalDownloadLimit: "",
  dailyDownloadLimit: "",
  isActive: true,
  order: "0",
};

function planToForm(plan: SubscriptionPlan): PlanFormState {
  return {
    name: plan.name,
    durationDays: String(plan.durationDays),
    priceVnd: String(plan.priceVnd),
    totalDownloadLimit: plan.totalDownloadLimit === null ? "" : String(plan.totalDownloadLimit),
    dailyDownloadLimit: plan.dailyDownloadLimit === null ? "" : String(plan.dailyDownloadLimit),
    isActive: plan.isActive,
    order: String(plan.order),
  };
}

// payload gửi lên API — number|null cho 2 field giới hạn (rỗng -> null = không giới hạn).
function formToPayload(form: PlanFormState) {
  return {
    name: form.name.trim(),
    durationDays: Number(form.durationDays) || 1,
    priceVnd: Number(form.priceVnd) || 0,
    totalDownloadLimit: form.totalDownloadLimit.trim() ? Number(form.totalDownloadLimit) : null,
    dailyDownloadLimit: form.dailyDownloadLimit.trim() ? Number(form.dailyDownloadLimit) : null,
    isActive: form.isActive,
    order: Number(form.order) || 0,
  };
}

function formatVnd(n: number): string {
  return n.toLocaleString("vi-VN") + "đ";
}

export default function AdminSubscriptionPlansPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<PlanFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PlanFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const reload = useCallback(() => {
    apiFetch<SubscriptionPlan[]>("/subscription-plans/admin")
      .then(setPlans)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, []);

  useEffect(() => {
    if (!user) return;
    reload();
  }, [user, reload]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setCreating(true);
    try {
      await apiFetch<SubscriptionPlan>("/subscription-plans", {
        method: "POST",
        body: JSON.stringify(formToPayload(createForm)),
      });
      setMessage("Đã tạo gói mới.");
      setCreateForm(EMPTY_FORM);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(plan: SubscriptionPlan) {
    setEditingId(plan.id);
    setEditForm(planToForm(plan));
  }

  async function handleSaveEdit(id: string) {
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await apiFetch<SubscriptionPlan>(`/subscription-plans/${id}`, {
        method: "PATCH",
        body: JSON.stringify(formToPayload(editForm)),
      });
      setMessage("Đã lưu thay đổi.");
      setEditingId(null);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(plan: SubscriptionPlan) {
    if (!confirm(`Xoá gói "${plan.name}"?`)) return;
    setError(null);
    setMessage(null);
    setDeletingId(plan.id);
    try {
      await apiFetch(`/subscription-plans/${plan.id}`, { method: "DELETE" });
      setMessage("Đã xoá gói.");
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleActive(plan: SubscriptionPlan) {
    setError(null);
    try {
      await apiFetch(`/subscription-plans/${plan.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !plan.isActive }),
      });
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.SETTINGS_SUBSCRIPTION)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Cài đặt Subscription</h1>
      <p className="text-sm text-zinc-500">
        Gói Subscription/VIP hiển thị dạng card ở trang nạp tiền. Thanh toán qua SePay (tách riêng,
        không đụng ví $P). Để trống 2 ô giới hạn tải = không giới hạn. Mua gói mới sẽ thay thế kỳ
        đang dùng (không cộng dồn thời hạn).
      </p>

      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      {/* Form tạo gói mới */}
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tạo gói mới</p>
        <PlanFields form={createForm} onChange={setCreateForm} />
        <button
          type="submit"
          disabled={creating}
          className="w-fit rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
        >
          {creating ? "Đang tạo..." : "Tạo gói"}
        </button>
      </form>

      {/* Danh sách gói */}
      <div className="flex flex-col gap-3">
        {plans === null && <p className="text-sm text-zinc-400">Đang tải...</p>}
        {plans?.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
            Chưa có gói nào.
          </p>
        )}
        {plans?.map((plan) =>
          editingId === plan.id ? (
            <div key={plan.id} className="flex flex-col gap-3 rounded-md border border-[#1d3557] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Sửa gói &quot;{plan.name}&quot;
              </p>
              <PlanFields form={editForm} onChange={setEditForm} />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveEdit(plan.id)}
                  disabled={saving}
                  className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : "Lưu"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Huỷ
                </button>
              </div>
            </div>
          ) : (
            <div
              key={plan.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-900">{plan.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      plan.isActive ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {plan.isActive ? "Đang bật" : "Đã tắt"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  {plan.durationDays} ngày · {formatVnd(plan.priceVnd)} · tổng tối đa{" "}
                  {plan.totalDownloadLimit ?? "không giới hạn"} link
                  {plan.dailyDownloadLimit !== null && ` · tối đa ${plan.dailyDownloadLimit} link/ngày`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleToggleActive(plan)}
                  className="rounded px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                >
                  {plan.isActive ? "Tắt" : "Bật"}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(plan)}
                  className="rounded px-2 py-1 text-xs font-medium text-[#1d3557] hover:bg-zinc-100"
                >
                  Sửa
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(plan)}
                  disabled={deletingId === plan.id}
                  className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-zinc-100 disabled:opacity-50"
                >
                  Xoá
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function PlanFields({
  form,
  onChange,
}: {
  form: PlanFormState;
  onChange: (next: PlanFormState) => void;
}) {
  function set<K extends keyof PlanFormState>(key: K, value: PlanFormState[K]) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Tên gói
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="VD: Gói 7 ngày"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Giá (VNĐ)
        <input
          type="number"
          min={1}
          value={form.priceVnd}
          onChange={(e) => set("priceVnd", e.target.value)}
          placeholder="1000000"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Thời hạn (ngày)
        <input
          type="number"
          min={1}
          value={form.durationDays}
          onChange={(e) => set("durationDays", e.target.value)}
          placeholder="7"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Thứ tự hiển thị
        <input
          type="number"
          value={form.order}
          onChange={(e) => set("order", e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Tổng số link được tải (để trống = không giới hạn)
        <input
          type="number"
          min={1}
          value={form.totalDownloadLimit}
          onChange={(e) => set("totalDownloadLimit", e.target.value)}
          placeholder="Không giới hạn"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Giới hạn link tải / ngày (tuỳ chọn, để trống = không giới hạn)
        <input
          type="number"
          min={1}
          value={form.dailyDownloadLimit}
          onChange={(e) => set("dailyDownloadLimit", e.target.value)}
          placeholder="Không giới hạn"
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
        />
        Đang bật (hiện ở trang nạp tiền)
      </label>
    </div>
  );
}
