import { useId } from "react";

// Bánh răng vẽ bằng toán học (không phải ảnh raster upload) — răng đặt đều quanh vòng tròn theo
// góc, cùng tinh thần "tự dựng hình minh hoạ" như logo-mark.tsx (SVG thuần, không phụ thuộc asset
// ngoài). Dùng chung cho cả 2 bánh răng lớn/nhỏ ở MaintenanceIllustration bên dưới.
function Gear({
  cx,
  cy,
  radius,
  teeth,
  toothWidth,
  toothHeight,
  fill,
  holeFill,
  holeRadius,
}: {
  cx: number;
  cy: number;
  radius: number;
  teeth: number;
  toothWidth: number;
  toothHeight: number;
  fill: string;
  holeFill: string;
  holeRadius: number;
}) {
  const teethEls = Array.from({ length: teeth }, (_, i) => {
    const angle = (i / teeth) * 2 * Math.PI;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const deg = (angle * 180) / Math.PI + 90;
    return (
      <rect
        key={i}
        x={x - toothWidth / 2}
        y={y - toothHeight / 2}
        width={toothWidth}
        height={toothHeight}
        rx={2}
        fill={fill}
        transform={`rotate(${deg} ${x} ${y})`}
      />
    );
  });
  return (
    <g>
      {teethEls}
      <circle cx={cx} cy={cy} r={radius * 0.78} fill={fill} />
      <circle cx={cx} cy={cy} r={holeRadius} fill={holeFill} />
    </g>
  );
}

// Hình minh hoạ Chế độ Bảo trì — 2 bánh răng ăn khớp (xoay chậm bằng CSS) + cờ lê, cùng bảng màu
// thương hiệu (navy #1d3557/#2b3f5c + gradient hồng-vàng của LogoMark). Không dùng ảnh upload/asset
// ngoài — Admin chỉ chỉnh được message, không chỉnh được hình theo yêu cầu.
export function MaintenanceIllustration({ size = 220 }: { size?: number }) {
  const gradientId = `maintenanceGradient-${useId()}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Website đang bảo trì"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5da2" />
          <stop offset="1" stopColor="#ffcf3f" />
        </linearGradient>
      </defs>

      <circle cx="120" cy="120" r="116" fill="#1d3557" opacity={0.06} />

      <g
        style={{
          transformOrigin: "95px 95px",
          animation: "kmn-gear-spin 12s linear infinite",
        }}
      >
        <Gear
          cx={95}
          cy={95}
          radius={52}
          teeth={10}
          toothWidth={14}
          toothHeight={16}
          fill="#2b3f5c"
          holeFill="#f4f5f7"
          holeRadius={16}
        />
      </g>

      <g
        style={{
          transformOrigin: "162px 150px",
          animation: "kmn-gear-spin-reverse 9s linear infinite",
        }}
      >
        <Gear
          cx={162}
          cy={150}
          radius={34}
          teeth={8}
          toothWidth={10}
          toothHeight={12}
          fill={`url(#${gradientId})`}
          holeFill="#f4f5f7"
          holeRadius={10}
        />
      </g>

      {/* Cờ lê — thân bo tròn nghiêng 45°, 2 đầu hình lục giác rỗng đơn giản hoá bằng vòng tròn.
          Màu sáng (#e4e4e7) để nổi trên cả nền trang tối (bg-[#16181d]) lẫn nền sáng (light mode). */}
      <g transform="rotate(-40 120 118)">
        <rect x="86" y="112" width="68" height="12" rx="6" fill="#e4e4e7" />
        <circle cx="82" cy="118" r="16" fill="none" stroke="#e4e4e7" strokeWidth={9} />
        <circle cx="158" cy="118" r="11" fill="none" stroke="#e4e4e7" strokeWidth={7} />
      </g>

      <style>{`
        @keyframes kmn-gear-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes kmn-gear-spin-reverse { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
      `}</style>
    </svg>
  );
}
