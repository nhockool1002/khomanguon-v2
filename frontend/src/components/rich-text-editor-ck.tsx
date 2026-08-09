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
  // Chỉ lấy "value" làm nội dung KHỞI TẠO — không tiếp tục đồng bộ mỗi lần "value" đổi. PostForm chỉ
  // mount CKEditor sau khi đã có dữ liệu bài viết thật (xem admin/posts/[id]/page.tsx: "{post &&
  // <PostForm .../>}") nên không cần cập nhật lại data sau mount. Nếu để prop "data" của <CKEditor>
  // đổi theo "value" sống (value đổi mỗi khi onChange bắn ngược lên PostForm.contentHtml), thư viện
  // @ckeditor/ckeditor5-react sẽ gọi editor.data.set() bất cứ khi nào editor.data.get() !==
  // nextProps.data (dist/index.js shouldUpdateEditorData) — chỉ cần lệch nhịp 1 chút giữa lúc gõ và
  // lúc React re-render kịp truyền prop xuống là data.set() chạy, XOÁ SẠCH lịch sử Undo/Redo và nhảy
  // con trỏ về đầu văn bản — đúng triệu chứng "focus/gõ vào editor bị kích hoạt Hoàn tác" đã gặp.
  const [initialData] = useState(value);

  const handleMediaSelect = useCallback((urls: string[]) => {
    const editor = editorRef.current;
    if (!editor || urls.length === 0) return;
    editor.execute("insertImage", { source: urls });
    editor.editing.view.focus();
  }, []);

  // Nguyên nhân THẬT đã xác nhận trực tiếp bằng devtools (click thật qua computer tool, không phải
  // sự kiện giả lập): bấm vào NÚT TOOLBAR (kể cả nút đang "disabled" như Hoàn tác lúc chưa có gì để
  // undo) khiến chính nút đó trở thành document.activeElement — cơ chế preventDefault(mousedown) mà
  // CKEditor tự dùng để tránh nút toolbar cướp focus khỏi vùng soạn thảo KHÔNG hoạt động trong tích
  // hợp React này. Hệ quả: người dùng thao tác gần toolbar/đầu nội dung, tiêu điểm bàn phím rơi vào
  // 1 nút toolbar (thường là Hoàn tác, nút đầu tiên) thay vì vùng nhập liệu — phím gõ tiếp theo
  // (Space/Enter) vô tình "bấm" nút đó thay vì gõ chữ, đúng triệu chứng "click vào editor bị Hoàn
  // tác/redo". Fix: tự chặn hành vi focus mặc định của trình duyệt khi mousedown xảy ra trên bất kỳ
  // nút toolbar nào (không chặn mousedown trong vùng nội dung) — đã verify trực tiếp: click nút vẫn
  // thực thi lệnh bình thường (vd Bold vẫn bật), chỉ khác là KHÔNG còn giữ lại focus bàn phím.
  const handleWrapperMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".ck-button")) {
      e.preventDefault();
    }
  }, []);

  return (
    <div
      className="ck-content-wrapper rounded-md border border-zinc-300 focus-within:border-[#1d3557] focus-within:ring-1 focus-within:ring-[#1d3557]"
      onMouseDown={handleWrapperMouseDown}
    >
      {/* prose prose-sm max-w-none: bọc riêng vùng CKEditor (không bọc MediaPickerModal bên dưới,
          tránh .prose img đè lên layout lưới thumbnail trong modal) — dùng chung class .prose với
          trang bài viết công khai (bai-viet/[slug]/page.tsx) để khung soạn thảo hiển thị giống hệt
          lúc xuất bản (heading, blockquote, list, ảnh...), thay vì lệch theo style mặc định của
          CKEditor. Các rule màu thương hiệu riêng cho heading/blockquote xem globals.css
          (selector .ck-content-wrapper .ck-content, cùng cặp với .prose). */}
      <div className="prose prose-sm max-w-none">
        <CKEditor
          editor={ClassicEditor}
          data={initialData}
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
      </div>
      <MediaPickerModal
        open={mediaModalOpen}
        multiple
        onClose={() => setMediaModalOpen(false)}
        onSelect={handleMediaSelect}
      />
    </div>
  );
}
