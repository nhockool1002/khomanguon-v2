"use client";

import dynamic from "next/dynamic";

// CKEditor 5 cần document/window (không SSR được) — nạp động phía client, xem rich-text-editor-ck.tsx
// cho phần cấu hình toolbar/plugin thật. Giữ nguyên tên file/export này để post-form.tsx không đổi.
const RichTextEditorCK = dynamic(() => import("@/components/rich-text-editor-ck"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[320px] items-center justify-center rounded-md border border-zinc-300 text-sm text-zinc-400">
      Đang tải trình soạn thảo...
    </div>
  ),
});

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  return <RichTextEditorCK value={value} onChange={onChange} />;
}
