"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { toAbsoluteUploadUrl } from "@/lib/upload";

// Slide chưa lưu chưa có id thật (DB cấp lúc PATCH/POST) — localId chỉ để React key + dnd-kit sortable
// id trong lúc soạn, không gửi lên server (server nhận lại slides[] không kèm id, tự tạo mới toàn bộ
// theo đúng cách SlidersService.syncSlides() đang làm — xem sliders.service.ts).
export interface EditableSlide {
  localId: string;
  imageUrl: string;
  linkUrl: string;
  caption: string;
}

function newLocalId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random()}`;
}

export function slidesToEditable(
  slides: { imageUrl: string; linkUrl: string | null; caption: string | null }[],
): EditableSlide[] {
  return slides.map((s) => ({
    localId: newLocalId(),
    imageUrl: s.imageUrl,
    linkUrl: s.linkUrl ?? "",
    caption: s.caption ?? "",
  }));
}

// Kéo-thả sắp xếp slide — cùng pattern @dnd-kit với widget-list-editor.tsx/menu-tree-editor.tsx.
// Khác widget: không có endpoint reorder riêng, thứ tự chỉ tính lại lúc submit (index trong mảng).
export function SliderSlidesEditor({
  slides,
  onChange,
  onOpenPicker,
}: {
  slides: EditableSlide[];
  onChange: (slides: EditableSlide[]) => void;
  onOpenPicker: () => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = slides.findIndex((s) => s.localId === active.id);
    const newIndex = slides.findIndex((s) => s.localId === over.id);
    onChange(arrayMove(slides, oldIndex, newIndex));
  }

  function updateSlide(localId: string, patch: Partial<EditableSlide>) {
    onChange(slides.map((s) => (s.localId === localId ? { ...s, ...patch } : s)));
  }

  function removeSlide(localId: string) {
    onChange(slides.filter((s) => s.localId !== localId));
  }

  return (
    <div className="flex flex-col gap-2">
      {slides.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-400">
          Chưa có ảnh nào — bấm &quot;+ Thêm ảnh&quot; để chọn từ Thư viện Media.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slides.map((s) => s.localId)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {slides.map((slide) => (
                <SortableSlideRow
                  key={slide.localId}
                  slide={slide}
                  onChange={(patch) => updateSlide(slide.localId, patch)}
                  onRemove={() => removeSlide(slide.localId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <button
        type="button"
        onClick={onOpenPicker}
        className="w-fit rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        + Thêm ảnh
      </button>
    </div>
  );
}

function SortableSlideRow({
  slide,
  onChange,
  onRemove,
}: {
  slide: EditableSlide;
  onChange: (patch: Partial<EditableSlide>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.localId,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border border-zinc-200 bg-white p-2 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex-none cursor-grab text-zinc-400 hover:text-zinc-600 active:cursor-grabbing"
        aria-label="Kéo để đổi vị trí"
      >
        <GripVertical size={16} />
      </button>
      <div className="h-14 w-20 flex-none overflow-hidden rounded bg-zinc-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={toAbsoluteUploadUrl(slide.imageUrl)}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <input
          value={slide.caption}
          onChange={(e) => onChange({ caption: e.target.value })}
          placeholder="Chú thích (tuỳ chọn)"
          className="rounded-md border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        />
        <input
          value={slide.linkUrl}
          onChange={(e) => onChange({ linkUrl: e.target.value })}
          placeholder="Link khi bấm vào ảnh (tuỳ chọn)"
          className="rounded-md border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Xoá ảnh này"
        className="flex-none rounded p-1.5 text-red-500 hover:bg-red-50"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
