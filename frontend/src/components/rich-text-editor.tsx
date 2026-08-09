"use client";

import { useCallback, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { MediaPickerModal } from "@/components/media-picker-modal";

const HEADING_LEVELS = [1, 2, 3, 4] as const;

// WYSIWYG cho nội dung bài viết (Phase 2.1) — bộ công cụ đầy đủ: định dạng chữ, căn lề,
// màu chữ/highlight, danh sách/checklist, bảng, sub/superscript, undo-redo.
export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapImage,
      TiptapLink.configure({ openOnClick: false }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Subscript,
      Superscript,
      Placeholder.configure({ placeholder: "Viết nội dung bài viết..." }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[320px] px-3 py-2 focus:outline-none [&_img]:rounded-md [&_img]:max-w-full [&_table]:w-full",
      },
    },
  });

  // Chèn nhiều ảnh cùng lúc qua insertContent (mảng node ảnh) thay vì gọi setImage() lặp lại nhiều
  // lần — insertContent chèn đúng thứ tự trong 1 transaction, setImage lặp có thể chèn sai vị trí
  // do mỗi lần gọi tự dịch chuyển con trỏ.
  const handleMediaSelect = useCallback(
    (urls: string[]) => {
      if (!editor || urls.length === 0) return;
      editor
        .chain()
        .focus()
        .insertContent(urls.map((src) => ({ type: "image", attrs: { src } })))
        .run();
    },
    [editor],
  );

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt("URL liên kết", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  const inTable = editor.isActive("table");
  const currentHeading = HEADING_LEVELS.find((level) => editor.isActive("heading", { level }));

  return (
    <div className="rounded-md border border-zinc-300 focus-within:border-[#1d3557] focus-within:ring-1 focus-within:ring-[#1d3557]">
      <div className="flex flex-col gap-1 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5">
        {/* Hàng 1: undo/redo, kiểu đoạn văn, định dạng chữ cơ bản, sub/superscript */}
        <div className="flex flex-wrap items-center gap-1">
          <ToolbarButton title="Hoàn tác" onClick={() => editor.chain().focus().undo().run()}>
            ↶
          </ToolbarButton>
          <ToolbarButton title="Làm lại" onClick={() => editor.chain().focus().redo().run()}>
            ↷
          </ToolbarButton>
          <Divider />
          <select
            title="Kiểu đoạn văn"
            value={currentHeading ?? "p"}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "p") editor.chain().focus().setParagraph().run();
              else
                editor
                  .chain()
                  .focus()
                  .toggleHeading({ level: Number(v) as 1 | 2 | 3 | 4 })
                  .run();
            }}
            className="rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs text-zinc-700"
          >
            <option value="p">Đoạn văn</option>
            {HEADING_LEVELS.map((level) => (
              <option key={level} value={level}>
                Tiêu đề {level}
              </option>
            ))}
          </select>
          <Divider />
          <ToolbarButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <b>B</b>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <i>I</i>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <u>U</u>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <s>S</s>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            {"</>"}
          </ToolbarButton>
          <Divider />
          <ToolbarButton
            title="Chỉ số dưới"
            active={editor.isActive("subscript")}
            onClick={() => editor.chain().focus().toggleSubscript().run()}
          >
            X₂
          </ToolbarButton>
          <ToolbarButton
            title="Chỉ số trên"
            active={editor.isActive("superscript")}
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
          >
            X²
          </ToolbarButton>
          <Divider />
          <ToolbarButton
            title="Xoá định dạng"
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          >
            🧹
          </ToolbarButton>
        </div>

        {/* Hàng 2: căn lề, màu chữ, highlight, danh sách/checklist/trích dẫn */}
        <div className="flex flex-wrap items-center gap-1">
          <ToolbarButton
            title="Căn trái"
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            ⯇
          </ToolbarButton>
          <ToolbarButton
            title="Căn giữa"
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            ☰
          </ToolbarButton>
          <ToolbarButton
            title="Căn phải"
            active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            ⯈
          </ToolbarButton>
          <ToolbarButton
            title="Căn đều"
            active={editor.isActive({ textAlign: "justify" })}
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          >
            ☱
          </ToolbarButton>
          <Divider />
          <label title="Màu chữ" className="flex items-center gap-1 text-xs text-zinc-600">
            A
            <input
              type="color"
              className="h-6 w-6 cursor-pointer rounded border border-zinc-300 p-0"
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            />
          </label>
          <label title="Màu highlight" className="flex items-center gap-1 text-xs text-zinc-600">
            🖊
            <input
              type="color"
              defaultValue="#fef08a"
              className="h-6 w-6 cursor-pointer rounded border border-zinc-300 p-0"
              onChange={(e) =>
                editor.chain().focus().toggleHighlight({ color: e.target.value }).run()
              }
            />
          </label>
          <Divider />
          <ToolbarButton
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            • List
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1. List
          </ToolbarButton>
          <ToolbarButton
            title="Checklist"
            active={editor.isActive("taskList")}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          >
            ☑ List
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            &ldquo; &rdquo;
          </ToolbarButton>
          <ToolbarButton
            title="Khối mã"
            active={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            {"{ }"}
          </ToolbarButton>
          <ToolbarButton
            title="Đường kẻ ngang"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            ―
          </ToolbarButton>
        </div>

        {/* Hàng 3: liên kết, ảnh, bảng */}
        <div className="flex flex-wrap items-center gap-1">
          <ToolbarButton active={editor.isActive("link")} onClick={setLink}>
            🔗
          </ToolbarButton>
          <ToolbarButton onClick={() => setMediaModalOpen(true)}>🖼 Ảnh</ToolbarButton>
          <Divider />
          <ToolbarButton
            title="Chèn bảng"
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
          >
            ▦ Bảng
          </ToolbarButton>
          {inTable && (
            <>
              <ToolbarButton
                title="Thêm hàng"
                onClick={() => editor.chain().focus().addRowAfter().run()}
              >
                +hàng
              </ToolbarButton>
              <ToolbarButton
                title="Thêm cột"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
              >
                +cột
              </ToolbarButton>
              <ToolbarButton
                title="Xoá hàng"
                onClick={() => editor.chain().focus().deleteRow().run()}
              >
                -hàng
              </ToolbarButton>
              <ToolbarButton
                title="Xoá cột"
                onClick={() => editor.chain().focus().deleteColumn().run()}
              >
                -cột
              </ToolbarButton>
              <ToolbarButton
                title="Xoá bảng"
                onClick={() => editor.chain().focus().deleteTable().run()}
              >
                🗑 bảng
              </ToolbarButton>
            </>
          )}
        </div>
      </div>
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

function ToolbarButton({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        active ? "bg-[#1d3557] text-white" : "text-zinc-600 hover:bg-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-zinc-300" aria-hidden />;
}
