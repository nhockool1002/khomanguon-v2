import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    sliderEmbed: {
      insertSliderEmbed: (attrs: { sliderId: string; title: string }) => ReturnType;
    };
  }
}

// Node atom (không có children, không cho gõ chữ bên trong) đại diện 1 slider đã chèn vào bài viết
// — lưu lại trong contentHtml dưới dạng <div data-slider-embed data-slider-id="..." ...>, KHÔNG lưu
// dữ liệu slider (ảnh/config) trực tiếp vào bài viết vì Slider có thể sửa sau ở trang Quản lý Slider
// mà không cần sửa lại từng bài viết đã chèn nó. Trang công khai (prose-content.tsx) tìm các div này
// sau khi render contentHtml, gọi API lấy Slider mới nhất theo sliderId rồi mount SliderCarousel đè
// lên — cùng kỹ thuật "post-process DOM sau dangerouslySetInnerHTML" đã dùng cho .img-shine.
export const SliderEmbed = Node.create({
  name: "sliderEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      sliderId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-slider-id"),
        renderHTML: (attrs) => ({ "data-slider-id": attrs.sliderId }),
      },
      title: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-slider-title"),
        renderHTML: (attrs) => ({ "data-slider-title": attrs.title }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-slider-embed]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-slider-embed": "",
        class: "slider-embed-placeholder",
      }),
      `🎞️ Slider: ${(HTMLAttributes["data-slider-title"] as string) || "(chưa đặt tên)"}`,
    ];
  },

  addCommands() {
    return {
      insertSliderEmbed:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
