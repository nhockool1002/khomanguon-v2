"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { toAbsoluteUploadUrl } from "@/lib/upload";
import type { Slider } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";

// Modal chọn 1 Slider có sẵn để chèn vào bài viết — cùng cấu trúc với media-picker-modal.tsx nhưng
// đơn giản hơn (không phân trang/upload, GET /sliders công khai và số lượng slider thường không
// nhiều bằng số ảnh trong Thư viện Media).
export function SliderPickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (slider: Slider) => void;
}) {
  const [items, setItems] = useState<Slider[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedOpen, setSyncedOpen] = useState(open);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đặt cờ loading đồng bộ trước khi gọi API, đúng chủ đích (cùng pattern media-picker-modal.tsx)
    setFetching(true);
    setError(null);
    apiFetch<Slider[]>("/sliders")
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"))
      .finally(() => setFetching(false));
  }, [open]);

  // Reset trạng thái mỗi lần mở lại — cùng pattern với media-picker-modal.tsx.
  if (open !== syncedOpen) {
    setSyncedOpen(open);
  }

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col gap-3 overflow-hidden rounded-lg bg-white p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Chọn Slider để chèn</h2>
            <p className="text-xs text-zinc-500">
              Tạo/chỉnh sửa slider ở trang{" "}
              <span className="font-medium text-zinc-700">Quản lý Slider</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            ✕
          </button>
        </div>

        <ErrorBanner message={error} />

        <div className="flex-1 overflow-y-auto">
          {fetching ? (
            <p className="px-4 py-10 text-center text-sm text-zinc-400">Đang tải...</p>
          ) : items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
              Chưa có slider nào — tạo slider ở trang Quản lý Slider trước.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((slider) => (
                <button
                  key={slider.id}
                  type="button"
                  onClick={() => {
                    onSelect(slider);
                    onClose();
                  }}
                  className="flex flex-col overflow-hidden rounded-md border-2 border-transparent bg-zinc-100 text-left transition-colors hover:border-[#1d3557]"
                >
                  <div className="aspect-video w-full overflow-hidden bg-zinc-200">
                    {slider.slides[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={toAbsoluteUploadUrl(slider.slides[0].imageUrl)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="truncate text-sm font-medium text-zinc-800">{slider.title}</p>
                    <p className="text-xs text-zinc-500">{slider.slides.length} ảnh</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
