"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { Slider, SliderBulletStyle, SliderTransitionStyle } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";
import { MediaPickerModal } from "@/components/media-picker-modal";
import { toAbsoluteUploadUrl } from "@/lib/upload";
import {
  SliderSlidesEditor,
  slidesToEditable,
  type EditableSlide,
} from "@/components/slider-slides-editor";

const BULLET_STYLE_LABEL: Record<SliderBulletStyle, string> = {
  DOTS: "Chấm tròn (dots)",
  NUMBERS: "Số trang",
  THUMBNAILS: "Ảnh thu nhỏ",
  NONE: "Không hiện",
};

const TRANSITION_STYLE_LABEL: Record<SliderTransitionStyle, string> = {
  SLIDE: "Trượt ngang",
  FADE: "Mờ dần",
  ZOOM: "Phóng to/thu nhỏ",
  CUBE: "Khối lập phương",
  COVERFLOW: "Coverflow",
};

export default function AdminSlidersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Slider[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Slider | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<Slider[]>("/sliders")
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [user]);

  async function load() {
    try {
      setItems(await apiFetch<Slider[]>("/sliders"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleCreate() {
    setError(null);
    setCreating(true);
    try {
      const created = await apiFetch<Slider>("/sliders", {
        method: "POST",
        body: JSON.stringify({ title: "Slider mới", slides: [] }),
      });
      await load();
      setSelected(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(slider: Slider) {
    if (!confirm(`Xoá slider "${slider.title}"?`)) return;
    setError(null);
    try {
      await apiFetch(`/sliders/${slider.id}`, { method: "DELETE" });
      if (selected?.id === slider.id) setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  async function handleSaveSelected(values: {
    title: string;
    bulletStyle: SliderBulletStyle;
    transitionStyle: SliderTransitionStyle;
    autoplay: boolean;
    autoplayDelayMs: number;
    loop: boolean;
    slides: EditableSlide[];
  }) {
    if (!selected) return;
    setError(null);
    try {
      await apiFetch(`/sliders/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: values.title,
          bulletStyle: values.bulletStyle,
          transitionStyle: values.transitionStyle,
          autoplay: values.autoplay,
          autoplayDelayMs: values.autoplayDelayMs,
          loop: values.loop,
          slides: values.slides.map((s, index) => ({
            imageUrl: s.imageUrl,
            linkUrl: s.linkUrl.trim() || undefined,
            caption: s.caption.trim() || undefined,
            order: index,
          })),
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
  if (!user.permissionKeys?.includes(PERMISSIONS.SLIDER_MANAGE)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Quản lý Slider</h1>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
        >
          + Tạo slider mới
        </button>
      </div>
      <p className="text-sm text-zinc-500">
        Tạo slider từ ảnh trong Thư viện Media, chèn vào bài viết qua nút &quot;Chèn Slider&quot; trong
        trình soạn.
      </p>

      <ErrorBanner message={error} />

      {items && items.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Chưa có slider nào.
        </p>
      )}

      {items && items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((slider) => (
            <div
              key={slider.id}
              className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              {slider.slides[0] ? (
                <div className="h-12 w-16 flex-none overflow-hidden rounded bg-zinc-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={toAbsoluteUploadUrl(slider.slides[0].imageUrl)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-12 w-16 flex-none rounded bg-zinc-100" />
              )}
              <div className="flex flex-1 flex-col">
                <span className="font-medium text-zinc-800">{slider.title}</span>
                <span className="text-xs text-zinc-500">
                  {slider.slides.length} ảnh · {BULLET_STYLE_LABEL[slider.bulletStyle]} ·{" "}
                  {TRANSITION_STYLE_LABEL[slider.transitionStyle]}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelected(slider)}
                  className="rounded px-2 py-0.5 text-xs font-medium text-[#1d3557] hover:bg-zinc-100"
                >
                  sửa
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(slider)}
                  className="rounded px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-zinc-100"
                >
                  xoá
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <SliderEditPanel
          key={selected.id}
          slider={selected}
          onCancel={() => setSelected(null)}
          onSave={handleSaveSelected}
        />
      )}
    </div>
  );
}

function SliderEditPanel({
  slider,
  onCancel,
  onSave,
}: {
  slider: Slider;
  onCancel: () => void;
  onSave: (values: {
    title: string;
    bulletStyle: SliderBulletStyle;
    transitionStyle: SliderTransitionStyle;
    autoplay: boolean;
    autoplayDelayMs: number;
    loop: boolean;
    slides: EditableSlide[];
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(slider.title);
  const [bulletStyle, setBulletStyle] = useState<SliderBulletStyle>(slider.bulletStyle);
  const [transitionStyle, setTransitionStyle] = useState<SliderTransitionStyle>(
    slider.transitionStyle,
  );
  const [autoplay, setAutoplay] = useState(slider.autoplay);
  const [autoplayDelayMs, setAutoplayDelayMs] = useState(slider.autoplayDelayMs);
  const [loop, setLoop] = useState(slider.loop);
  const [slides, setSlides] = useState<EditableSlide[]>(() => slidesToEditable(slider.slides));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ title, bulletStyle, transitionStyle, autoplay, autoplayDelayMs, loop, slides });
    } finally {
      setSaving(false);
    }
  }

  return (
    // MediaPickerModal tự có <form> riêng cho ô tìm kiếm (media-picker-modal.tsx) — không được lồng
    // trong <form> ngoài này (HTML không cho phép <form> lồng nhau, trình duyệt sẽ tự đóng sớm
    // <form> ngoài khi gặp <form> con, khiến nút "Lưu" mất tác dụng submit). Đặt modal là sibling
    // sau </form> thay vì con trực tiếp của nó.
    <>
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Chỉnh sửa slider</p>

      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Tiêu đề (nội bộ, không hiện ngoài trang)
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        />
      </label>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Kiểu bullet
          <select
            value={bulletStyle}
            onChange={(e) => setBulletStyle(e.target.value as SliderBulletStyle)}
            className="w-48 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          >
            {(Object.keys(BULLET_STYLE_LABEL) as SliderBulletStyle[]).map((key) => (
              <option key={key} value={key}>
                {BULLET_STYLE_LABEL[key]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Kiểu chuyển cảnh
          <select
            value={transitionStyle}
            onChange={(e) => setTransitionStyle(e.target.value as SliderTransitionStyle)}
            className="w-48 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
          >
            {(Object.keys(TRANSITION_STYLE_LABEL) as SliderTransitionStyle[]).map((key) => (
              <option key={key} value={key}>
                {TRANSITION_STYLE_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 text-sm text-zinc-700">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
          Lặp vô hạn
        </label>
        <label className="flex items-center gap-1.5 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={autoplay}
            onChange={(e) => setAutoplay(e.target.checked)}
          />
          Tự động chạy
        </label>
        {autoplay && (
          <label className="flex items-center gap-1.5 text-sm text-zinc-700">
            Thời gian mỗi ảnh (ms)
            <input
              type="number"
              min={500}
              step={100}
              value={autoplayDelayMs}
              onChange={(e) => setAutoplayDelayMs(Math.max(500, Number(e.target.value) || 500))}
              className="w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
            />
          </label>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-zinc-700">Danh sách ảnh (kéo ⣿ để đổi thứ tự)</span>
        <SliderSlidesEditor slides={slides} onChange={setSlides} onOpenPicker={() => setPickerOpen(true)} />
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

      <MediaPickerModal
        open={pickerOpen}
        multiple
        onClose={() => setPickerOpen(false)}
        onSelect={(urls) =>
          setSlides((prev) => [
            ...prev,
            ...slidesToEditable(urls.map((url) => ({ imageUrl: url, linkUrl: null, caption: null }))),
          ])
        }
      />
    </>
  );
}
