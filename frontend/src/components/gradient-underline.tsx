// Gạch chân gradient hồng->vàng kế thừa từ v1 (mục 02 tài liệu thiết kế) — dùng dưới tiêu đề bài viết/danh mục.
export function GradientUnderline({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-[3px] w-16 rounded-sm bg-gradient-to-r from-[#ff5da2] to-[#ffcf3f] ${className}`}
    />
  );
}
