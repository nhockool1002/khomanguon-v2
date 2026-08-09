"use client";

import { useCallback, useState } from "react";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import Color from "@tiptap/extension-color";
import { TextStyle, BackgroundColor } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import TiptapImage from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Undo2,
  Redo2,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough,
  Code as CodeIcon,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  RemoveFormatting,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code2,
  Minus,
  Link2,
  Unlink,
  ImagePlus,
  Table as TableIcon,
} from "lucide-react";
import { MediaPickerModal } from "@/components/media-picker-modal";

// WYSIWYG cho nội dung bài viết — Tiptap (đổi từ CKEditor 5, 2026-08-09, yêu cầu thực tế: CKEditor
// cướp focus bàn phím về nút toolbar sau khi click nội dung, dù đã 3 lần vá vẫn tái diễn — xem lịch
// sử PR #55/#56/#57). Tiptap dựa trên ProseMirror, toolbar do MÌNH tự viết bằng React thuần (không
// phải UI đóng gói sẵn như CKEditor) nên tự kiểm soát HOÀN TOÀN hành vi focus: mọi nút bấm đều có
// onMouseDown={preventDefault} — kỹ thuật chuẩn để nút toolbar không bao giờ cướp focus khỏi vùng
// soạn thảo, loại bỏ tận gốc cả nhóm bug đã gặp với CKEditor thay vì vá từng triệu chứng.
const HEADING_OPTIONS = [
  { value: "0", label: "Đoạn văn" },
  { value: "1", label: "Tiêu đề 1" },
  { value: "2", label: "Tiêu đề 2" },
  { value: "3", label: "Tiêu đề 3" },
  { value: "4", label: "Tiêu đề 4" },
] as const;

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      // preventDefault ở mousedown (KHÔNG phải onClick) — chặn hành vi mặc định "focus vào nút" của
      // trình duyệt trước khi nó xảy ra, giữ nguyên focus bàn phím đang ở vùng soạn thảo. onClick vẫn
      // chạy bình thường sau đó vì preventDefault(mousedown) không ảnh hưởng tới sự kiện click.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        active ? "bg-[#1d3557] text-white" : "text-zinc-700 hover:bg-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-6 w-px shrink-0 bg-zinc-200" aria-hidden />;
}

function Toolbar({
  editor,
  onOpenMediaPicker,
}: {
  editor: Editor;
  onOpenMediaPicker: () => void;
}) {
  const currentHeadingValue = HEADING_OPTIONS.find(({ value }) =>
    value === "0" ? editor.isActive("paragraph") : editor.isActive("heading", { level: Number(value) }),
  )?.value ?? "0";

  function setHeading(value: string) {
    const chain = editor.chain().focus();
    if (value === "0") chain.setParagraph().run();
    else chain.toggleHeading({ level: Number(value) as 1 | 2 | 3 | 4 }).run();
  }

  function setLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Nhập URL liên kết:", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-300 bg-zinc-50 p-1.5">
      <ToolbarButton title="Hoàn tác" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 size={16} />
      </ToolbarButton>
      <ToolbarButton title="Làm lại" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 size={16} />
      </ToolbarButton>
      <ToolbarDivider />
      <select
        value={currentHeadingValue}
        onMouseDown={(e) => e.preventDefault()}
        onChange={(e) => setHeading(e.target.value)}
        className="h-8 rounded border border-zinc-300 bg-white px-1.5 text-sm text-zinc-700"
      >
        {HEADING_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ToolbarDivider />
      <ToolbarButton title="Đậm" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <BoldIcon size={16} />
      </ToolbarButton>
      <ToolbarButton title="Nghiêng" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <ItalicIcon size={16} />
      </ToolbarButton>
      <ToolbarButton title="Gạch chân" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon size={16} />
      </ToolbarButton>
      <ToolbarButton title="Gạch ngang" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough size={16} />
      </ToolbarButton>
      <ToolbarButton title="Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <CodeIcon size={16} />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton title="Chỉ số dưới" active={editor.isActive("subscript")} onClick={() => editor.chain().focus().toggleSubscript().run()}>
        <SubscriptIcon size={16} />
      </ToolbarButton>
      <ToolbarButton title="Chỉ số trên" active={editor.isActive("superscript")} onClick={() => editor.chain().focus().toggleSuperscript().run()}>
        <SuperscriptIcon size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Xoá định dạng"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        <RemoveFormatting size={16} />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton title="Căn trái" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft size={16} />
      </ToolbarButton>
      <ToolbarButton title="Căn giữa" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter size={16} />
      </ToolbarButton>
      <ToolbarButton title="Căn phải" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight size={16} />
      </ToolbarButton>
      <ToolbarButton title="Căn đều" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
        <AlignJustify size={16} />
      </ToolbarButton>
      <label
        title="Màu chữ"
        onMouseDown={(e) => e.preventDefault()}
        className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded text-zinc-700 hover:bg-zinc-100"
      >
        <span className="text-sm font-bold" style={{ color: editor.getAttributes("textStyle").color || undefined }}>
          A
        </span>
        <input
          type="color"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onInput={(e) => editor.chain().focus().setColor(e.currentTarget.value).run()}
        />
      </label>
      <label
        title="Màu nền chữ"
        onMouseDown={(e) => e.preventDefault()}
        className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded text-zinc-700 hover:bg-zinc-100"
      >
        <span
          className="flex h-4 w-4 items-center justify-center rounded-sm border border-zinc-300 text-[10px] font-bold"
          style={{ backgroundColor: editor.getAttributes("highlight").color || editor.getAttributes("textStyle").backgroundColor || undefined }}
        >
          A
        </span>
        <input
          type="color"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onInput={(e) => editor.chain().focus().toggleHighlight({ color: e.currentTarget.value }).run()}
        />
      </label>
      <ToolbarDivider />
      <ToolbarButton title="Danh sách chấm" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton title="Danh sách số" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={16} />
      </ToolbarButton>
      <ToolbarButton title="Việc cần làm" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <ListTodo size={16} />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton title="Trích dẫn" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote size={16} />
      </ToolbarButton>
      <ToolbarButton title="Khối code" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code2 size={16} />
      </ToolbarButton>
      <ToolbarButton title="Đường kẻ ngang" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus size={16} />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton title="Chèn/sửa liên kết" active={editor.isActive("link")} onClick={setLink}>
        <Link2 size={16} />
      </ToolbarButton>
      {editor.isActive("link") && (
        <ToolbarButton title="Bỏ liên kết" onClick={() => editor.chain().focus().unsetLink().run()}>
          <Unlink size={16} />
        </ToolbarButton>
      )}
      <ToolbarButton title="Chọn ảnh" onClick={onOpenMediaPicker}>
        <ImagePlus size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Chèn bảng"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <TableIcon size={16} />
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  const editor = useEditor({
    // Tránh render trên server (App Router SSR) — Tiptap/ProseMirror cần document/window, và render
    // khác nhau giữa server/client sẽ gây lệch hydrate; false = chỉ render thật sau khi mount ở client.
    immediatelyRender: false,
    content: value,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[320px] px-3 py-2 focus:outline-none",
      },
    },
    extensions: [
      StarterKit,
      Subscript,
      Superscript,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      BackgroundColor,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit,
      TiptapImage,
      Placeholder.configure({ placeholder: "Viết nội dung bài viết..." }),
    ],
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const handleMediaSelect = useCallback(
    (urls: string[]) => {
      if (!editor || urls.length === 0) return;
      urls.forEach((src) => editor.chain().focus().setImage({ src }).run());
    },
    [editor],
  );

  if (!editor) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-md border border-zinc-300 text-sm text-zinc-400">
        Đang tải trình soạn thảo...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-zinc-300 focus-within:border-[#1d3557] focus-within:ring-1 focus-within:ring-[#1d3557]">
      <Toolbar editor={editor} onOpenMediaPicker={() => setMediaModalOpen(true)} />
      <EditorContent editor={editor} />
      <MediaPickerModal
        open={mediaModalOpen}
        multiple
        onClose={() => setMediaModalOpen(false)}
        onSelect={handleMediaSelect}
      />
    </div>
  );
}
