import { useId } from "react";

// Đồng bộ hình học với brand/logo-mark.svg ở gốc repo — xem Branding_Guide.md.
export function LogoMark({ size = 32 }: { size?: number }) {
  // id gradient phải duy nhất trong toàn document — dùng useId() để tránh đụng độ khi component
  // này render nhiều lần trên cùng 1 trang (vd navbar + banner trang đăng nhập cùng lúc).
  const gradientId = `kmnGradient-${useId()}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="khomanguon"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5da2" />
          <stop offset="1" stopColor="#ffcf3f" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#2b3f5c" />
      <polyline
        points="24,20 36,32 24,44"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="38" y="41" width="13" height="6" rx="3" fill={`url(#${gradientId})`} />
    </svg>
  );
}
