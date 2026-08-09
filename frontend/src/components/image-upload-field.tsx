"use client";

import { useState } from "react";
import { MediaPickerModal } from "@/components/media-picker-modal";

// Chọn ảnh thumbnail/OG image từ Thư viện Media (modal kiểu WordPress) thay vì chỉ upload file rời
// rạc — dùng chung cho cả "Ảnh đại diện" và "Ảnh OG" (Phase 2.1, nâng cấp 2026-08-09).
export function ImageUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-zinc-700">{label}</span>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="h-32 w-full rounded-md border border-zinc-200 object-cover"
        />
      ) : (
        <div className="flex h-32 w-full items-center justify-center rounded-md border border-dashed border-zinc-300 text-xs text-zinc-400">
          Chưa có ảnh
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Chọn ảnh
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs font-medium text-red-600 hover:underline"
          >
            Xoá
          </button>
        )}
      </div>
      <MediaPickerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={(urls) => onChange(urls[0])}
      />
    </div>
  );
}
