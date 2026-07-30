"use client";

import { useMemo, useState } from "react";
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
import type { MenuItem } from "@/lib/types";

// 4 role mặc định của hệ thống (xem backend/src/roles/permissions.constant.ts DEFAULT_ROLES) —
// Custom role tạo qua UI (Phase 2.5) chưa có endpoint liệt kê, bổ sung khi module đó xây xong.
const DEFAULT_ROLE_OPTIONS = [
  { slug: "admin", name: "Admin" },
  { slug: "super-moderator", name: "Super Moderator" },
  { slug: "moderator", name: "Moderator" },
  { slug: "member", name: "Member" },
];

interface TreeNode extends MenuItem {
  children: TreeNode[];
}

function buildTree(items: MenuItem[]): TreeNode[] {
  const byParent = new Map<string, MenuItem[]>();
  for (const item of items) {
    const key = item.parentId ?? "";
    byParent.set(key, [...(byParent.get(key) ?? []), item]);
  }
  const attach = (parentId: string | null): TreeNode[] =>
    (byParent.get(parentId ?? "") ?? [])
      .sort((a, b) => a.order - b.order)
      .map((item) => ({ ...item, children: attach(item.id) }));
  return attach(null);
}

export function MenuTreeEditor({
  items,
  onReorder,
  onEdit,
  onDelete,
}: {
  items: MenuItem[];
  onReorder: (updates: { id: string; parentId: string | null; order: number }[]) => Promise<void>;
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
}) {
  const tree = useMemo(() => buildTree(items), [items]);

  return (
    <div className="flex flex-col gap-1">
      <SiblingGroup
        key={tree.map((n) => n.id).join(",")}
        nodes={tree}
        depth={0}
        allItems={items}
        onReorder={onReorder}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

function SiblingGroup({
  nodes,
  depth,
  allItems,
  onReorder,
  onEdit,
  onDelete,
}: {
  nodes: TreeNode[];
  depth: number;
  allItems: MenuItem[];
  onReorder: (updates: { id: string; parentId: string | null; order: number }[]) => Promise<void>;
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
}) {
  const [order, setOrder] = useState(() => nodes.map((n) => n.id));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const orderedNodes = order.map((id) => nodes.find((n) => n.id === id)).filter((n): n is TreeNode => !!n);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    const nextOrder = arrayMove(order, oldIndex, newIndex);
    setOrder(nextOrder);
    const parentId = nodes[0]?.parentId ?? null;
    await onReorder(nextOrder.map((id, index) => ({ id, parentId, order: index })));
  }

  async function handleIndent(node: TreeNode, index: number) {
    if (index === 0) return;
    const newParent = orderedNodes[index - 1];
    const siblingCount = allItems.filter((i) => i.parentId === newParent.id).length;
    await onReorder([{ id: node.id, parentId: newParent.id, order: siblingCount }]);
  }

  async function handleOutdent(node: TreeNode) {
    if (!node.parentId) return;
    const parent = allItems.find((i) => i.id === node.parentId);
    if (!parent) return;
    const newParentId = parent.parentId;
    const siblingCount = allItems.filter((i) => i.parentId === newParentId).length;
    await onReorder([{ id: node.id, parentId: newParentId ?? null, order: siblingCount }]);
  }

  if (nodes.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        {orderedNodes.map((node, index) => (
          <div key={node.id}>
            <SortableRow
              node={node}
              depth={depth}
              canOutdent={depth > 0}
              canIndent={index > 0}
              onIndent={() => handleIndent(node, index)}
              onOutdent={() => handleOutdent(node)}
              onEdit={() => onEdit(node)}
              onDelete={() => onDelete(node)}
            />
            {node.children.length > 0 && (
              <SiblingGroup
                key={node.children.map((c) => c.id).join(",")}
                nodes={node.children}
                depth={depth + 1}
                allItems={allItems}
                onReorder={onReorder}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            )}
          </div>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  node,
  depth,
  canOutdent,
  canIndent,
  onIndent,
  onOutdent,
  onEdit,
  onDelete,
}: {
  node: TreeNode;
  depth: number;
  canOutdent: boolean;
  canIndent: boolean;
  onIndent: () => void;
  onOutdent: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginLeft: depth * 26,
  };

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
      {node.icon && <span aria-hidden>{node.icon}</span>}
      <span className="font-medium text-zinc-800">{node.label}</span>
      <span className="truncate font-mono text-xs text-zinc-400">{node.url}</span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onOutdent}
          disabled={!canOutdent}
          title="Thụt ra (lên cấp cha)"
          className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
        >
          ⇤
        </button>
        <button
          type="button"
          onClick={onIndent}
          disabled={!canIndent}
          title="Thụt vào (làm con của mục phía trên)"
          className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
        >
          ⇥
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

export { DEFAULT_ROLE_OPTIONS };
