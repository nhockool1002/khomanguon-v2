"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fetchSliderById } from "@/lib/public-api";
import { SliderCarousel } from "@/components/slider-carousel";

// Bọc từng <img> trong nội dung bài viết bằng span.img-shine (hiệu ứng tráng gương khi hover, xem
// globals.css) — <img> là replaced element nên không tự nhận ::before/::after, phải có wrapper.
// Không parse lại chuỗi HTML bằng regex (dễ vỡ với thuộc tính/markup lồng nhau do Tiptap sinh ra) —
// bọc bằng DOM API thuần sau khi nội dung đã render.
//
// Cùng kỹ thuật cho slider chèn từ trình soạn (tiptap-slider-node.ts): contentHtml chỉ lưu 1 div
// placeholder <div data-slider-embed data-slider-id="..."> (không lưu dữ liệu slider trực tiếp, xem
// comment ở tiptap-slider-node.ts) — sau khi dangerouslySetInnerHTML render placeholder này, mount
// SliderCarousel (React) đè lên bằng createRoot ngay trên div đó. Luôn lấy Slider MỚI NHẤT theo
// sliderId lúc render (không phải snapshot lúc chèn) nên sửa slider ở trang Quản lý Slider tự động
// phản ánh vào mọi bài viết đã chèn nó.
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

    const roots: Root[] = [];
    let cancelled = false;
    container.querySelectorAll<HTMLElement>("[data-slider-embed]").forEach((el) => {
      const sliderId = el.getAttribute("data-slider-id");
      if (!sliderId) return;
      // "slider-embed-placeholder" (globals.css) chỉ để hiện khung nét đứt TRONG trình soạn — vẫn
      // còn nguyên trên chính div này (createRoot chỉ thay children, không đụng attribute của
      // container). Bỏ class này trước khi mount SliderCarousel thật vào: giữ nguyên (flex row +
      // align-items:center + padding) đụng độ với nội dung aspect-video bên trong gây layout vỡ
      // (đã xác nhận qua devtools — kích thước bị thổi phồng hàng chục nghìn px).
      el.className = "";
      const root = createRoot(el);
      roots.push(root);
      fetchSliderById(sliderId).then((slider) => {
        if (cancelled || !slider) return;
        root.render(<SliderCarousel slider={slider} />);
      });
    });

    return () => {
      cancelled = true;
      roots.forEach((root) => root.unmount());
    };
  }, [html]);

  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
