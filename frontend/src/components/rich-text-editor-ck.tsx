"use client";

import { useCallback, useRef, useState } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  ClassicEditor,
  Essentials,
  Paragraph,
  Heading,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Subscript,
  Superscript,
  RemoveFormat,
  Alignment,
  FontColor,
  FontBackgroundColor,
  List,
  TodoList,
  BlockQuote,
  CodeBlock,
  HorizontalLine,
  Link,
  AutoLink,
  Image,
  ImageToolbar,
  ImageCaption,
  ImageTextAlternative,
  Table,
  TableToolbar,
  Autoformat,
  Plugin,
  ButtonView,
  IconImage,
  type Editor,
  type EditorConfig,
} from "ckeditor5";
import coreTranslations from "ckeditor5/translations/vi.js";
import "ckeditor5/ckeditor5.css";
import { MediaPickerModal } from "@/components/media-picker-modal";

// Custom plugin đăng ký nút toolbar "Chọn ảnh" — chỉ gọi callback do config.mediaLibrary.open
// truyền vào (bridge sang React state mở MediaPickerModal), không tự xử lý upload. CKEditor
// không có cách "chèn ảnh qua modal ngoài" sẵn nên phải tự viết plugin tối giản này.
class InsertImageViaMediaLibrary extends Plugin {
  static get pluginName() {
    return "InsertImageViaMediaLibrary" as const;
  }

  init() {
    const editor = this.editor;
    editor.ui.componentFactory.add("insertImageViaMediaLibrary", (locale) => {
      const button = new ButtonView(locale);
      button.set({ label: "Chọn ảnh", icon: IconImage, tooltip: true, withText: true });
      button.on("execute", () => {
        const cfg = editor.config.get("mediaLibrary") as { open?: () => void } | undefined;
        cfg?.open?.();
      });
      return button;
    });
  }
}

// WYSIWYG cho nội dung bài viết (thay Tiptap 2026-08-09, yêu cầu thực tế) — CKEditor 5 self-hosted
// (gói "ckeditor5" all-in-one, licenseKey: "GPL" — dùng miễn phí cho mã nguồn mở, KHÔNG cần API
// key/tài khoản CKEditor Cloud). Nút "Chọn ảnh" mở MediaPickerModal (component dùng chung với Ảnh
// đại diện/Ảnh OG) thay vì input file thô — chọn 1 hoặc nhiều ảnh có sẵn trong Thư viện Media hoặc
// tải ảnh mới ngay trong modal, chèn tất cả cùng lúc qua editor.execute("insertImage", { source }).
export default function RichTextEditorCK({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editorRef = useRef<Editor | null>(null);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  const handleMediaSelect = useCallback((urls: string[]) => {
    const editor = editorRef.current;
    if (!editor || urls.length === 0) return;
    editor.execute("insertImage", { source: urls });
    editor.editing.view.focus();
  }, []);

  return (
    <div className="ck-content-wrapper rounded-md border border-zinc-300 focus-within:border-[#1d3557] focus-within:ring-1 focus-within:ring-[#1d3557]">
      <CKEditor
        editor={ClassicEditor}
        data={value}
        onReady={(editor) => {
          editorRef.current = editor;
        }}
        onChange={(_event, editor) => onChange(editor.getData())}
        // "as EditorConfig": EditorConfig (kiểu chuẩn CKEditor) không khai báo field "mediaLibrary"
        // — đây là field tự thêm, đọc lại trong InsertImageViaMediaLibrary qua editor.config.get().
        config={{
          licenseKey: "GPL",
          translations: [coreTranslations],
          language: "vi",
          placeholder: "Viết nội dung bài viết...",
          // setMediaModalOpen là setState — identity ổn định giữa các lần render nên closure này
          // luôn hoạt động đúng dù CKEditor chỉ đọc config 1 lần lúc khởi tạo (xem InsertImageViaMediaLibrary).
          mediaLibrary: { open: () => setMediaModalOpen(true) },
          plugins: [
            Essentials,
            Paragraph,
            Heading,
            Bold,
            Italic,
            Underline,
            Strikethrough,
            Code,
            Subscript,
            Superscript,
            RemoveFormat,
            Alignment,
            FontColor,
            FontBackgroundColor,
            List,
            TodoList,
            BlockQuote,
            CodeBlock,
            HorizontalLine,
            Link,
            AutoLink,
            Image,
            ImageToolbar,
            ImageCaption,
            ImageTextAlternative,
            Table,
            TableToolbar,
            Autoformat,
            InsertImageViaMediaLibrary,
          ],
          toolbar: {
            items: [
              "undo",
              "redo",
              "|",
              "heading",
              "|",
              "bold",
              "italic",
              "underline",
              "strikethrough",
              "code",
              "|",
              "subscript",
              "superscript",
              "removeFormat",
              "|",
              "alignment",
              "fontColor",
              "fontBackgroundColor",
              "|",
              "bulletedList",
              "numberedList",
              "todoList",
              "|",
              "blockQuote",
              "codeBlock",
              "horizontalLine",
              "|",
              "link",
              "insertImageViaMediaLibrary",
              "insertTable",
            ],
            shouldNotGroupWhenFull: true,
          },
          image: {
            toolbar: ["toggleImageCaption", "imageTextAlternative"],
          },
          table: {
            contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"],
          },
        } as EditorConfig}
      />
      <MediaPickerModal
        open={mediaModalOpen}
        multiple
        onClose={() => setMediaModalOpen(false)}
        onSelect={handleMediaSelect}
      />
    </div>
  );
}
