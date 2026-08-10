"use client";

import { useState } from "react";
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
import type { Widget, WidgetType } from "@/lib/types";

export const WIDGET_TYPE_LABEL: Record<WidgetType, string> = {
  SEARCH: "Tìm kiếm",
  CATEGORIES: "Danh mục",
  RECENT_POSTS: "Bài viết mới nhất",
  HTML: "HTML tự do",
  COMMENTS: "Bình luận",
  TOP_VIEWED: "Bài viết xem nhiều",
  RELATED_POSTS: "Bài viết liên quan",
};

// Danh sách phẳng kéo-thả sắp xếp — cùng pattern @dnd-kit với menu-tree-editor.tsx, bỏ phần
// thụt cấp/indent vì widget không có cây cha-con như menu.
export function WidgetListEditor({
  items,
  onReorder,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  items: Widget[];
  onReorder: (updates: { id: string; order: number }[]) => Promise<void>;
  onEdit: (widget: Widget) => void;
  onDelete: (widget: Widget) => void;
  onToggleActive: (widget: Widget) => void;
}) {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const [order, setOrder] = useState(() => sorted.map((w) => w.id));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const orderedWidgets = order
    .map((id) => items.find((w) => w.id === id))
    .filter((w): w is Widget => !!w);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    const nextOrder = arrayMove(order, oldIndex, newIndex);
    setOrder(nextOrder);
    await onReorder(nextOrder.map((id, index) => ({ id, order: index })));
  }

  if (orderedWidgets.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1">
          {orderedWidgets.map((widget) => (
            <SortableRow
              key={widget.id}
              widget={widget}
              onEdit={() => onEdit(widget)}
              onDelete={() => onDelete(widget)}
              onToggleActive={() => onToggleActive(widget)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  widget,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  widget: Widget;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-zinc-400 hover:text-zinc-600 active:cursor-grabbing"
        aria-label="Kéo để đổi vị trí"
      >
        ⠿
      </button>
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-500">
        {WIDGET_TYPE_LABEL[widget.type]}
      </span>
      <span className="font-medium text-zinc-800">{widget.title || <em className="text-zinc-400">(không tiêu đề)</em>}</span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleActive}
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            widget.isActive ? "text-emerald-600 hover:bg-zinc-100" : "text-zinc-400 hover:bg-zinc-100"
          }`}
        >
          {widget.isActive ? "Đang hiện" : "Đã ẩn"}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded px-2 py-0.5 text-xs font-medium text-[#1d3557] hover:bg-zinc-100"
        >
          sửa
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-zinc-100"
        >
          xoá
        </button>
      </div>
    </div>
  );
}
