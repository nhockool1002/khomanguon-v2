"use client";

import { useEffect, useRef } from "react";

// Bọc từng <img> trong nội dung bài viết bằng span.img-shine (hiệu ứng tráng gương khi hover, xem
// globals.css) — <img> là replaced element nên không tự nhận ::before/::after, phải có wrapper.
// Không parse lại chuỗi HTML bằng regex (dễ vỡ với thuộc tính/markup lồng nhau do Tiptap sinh ra) —
// bọc bằng DOM API thuần sau khi nội dung đã render.
export function ProseContent({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.querySelectorAll("img").forEach((img) => {
      if (img.parentElement?.classList.contains("img-shine")) return;
      const wrapper = document.createElement("span");
      wrapper.className = "img-shine";
      img.replaceWith(wrapper);
      wrapper.appendChild(img);
    });
  }, [html]);

  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
