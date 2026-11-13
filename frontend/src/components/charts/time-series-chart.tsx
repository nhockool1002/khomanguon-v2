"use client";

import { useId, useMemo, useState } from "react";

export interface SeriesPoint {
  bucket: string; // ISO string — mốc bắt đầu khoảng (giờ/ngày/tuần/tháng)
  count: number;
}

const WIDTH = 760;
const HEIGHT = 220;
const PAD_LEFT = 36;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;

function formatBucketLabel(iso: string, granularity: string): string {
  const d = new Date(iso);
  if (granularity === "hour") return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  if (granularity === "week" || granularity === "day")
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  return d.toLocaleDateString("vi-VN", { month: "2-digit", year: "2-digit" });
}

// Biểu đồ đường 1 chuỗi số liệu theo thời gian (lượt truy cập HOẶC lượt xem bài viết — tách 2 biểu
// đồ riêng, không gộp 2 trục y khác thang đo vào 1 chart, xem anti-pattern "dual-axis"). Tự vẽ bằng
// SVG thuần (không thêm thư viện chart mới) — có lớp hover (crosshair + tooltip) và 1 bảng dữ liệu
// thô ẩn/hiện được để không phụ thuộc hoàn toàn vào màu/hình ảnh (yêu cầu khả năng tiếp cận).
export function TimeSeriesChart({
  data,
  granularity,
  color,
  label,
}: {
  data: SeriesPoint[];
  granularity: string;
  color: string;
  label: string;
}) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const points = useMemo(
    () =>
      data.map((d, i) => {
        const x = data.length <= 1 ? PAD_LEFT : PAD_LEFT + (i / (data.length - 1)) * innerW;
        const y = PAD_TOP + innerH - (d.count / maxCount) * innerH;
        return { x, y, ...d };
      }),
    [data, innerW, innerH, maxCount],
  );

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1]?.x.toFixed(1) ?? 0},${PAD_TOP + innerH} L${points[0]?.x.toFixed(1) ?? 0},${PAD_TOP + innerH} Z`;

  // Chỉ in nhãn trục X thưa (tối đa ~7 nhãn) — tránh chữ đè lên nhau khi khoảng dài (vd 2 năm ~24
  // điểm tháng vẫn còn đọc được, nhưng "Hôm nay" ~24 điểm giờ thì phải thưa bớt).
  const labelStep = Math.max(1, Math.ceil(points.length / 7));

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const x = xRatio * WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - x);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-zinc-700">{label}</p>
        <p className="text-xs text-zinc-400">
          Tổng: <span className="font-semibold text-zinc-600">{total.toLocaleString("vi-VN")}</span>
        </p>
      </div>

      {data.length === 0 || total === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-zinc-400">
          Chưa có dữ liệu trong khoảng thời gian này.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none"
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverIndex(null)}
          role="img"
          aria-label={`Biểu đồ ${label}, tổng ${total}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Gridline ngang mờ — tham chiếu, không phải dữ liệu */}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={PAD_TOP + innerH * (1 - f)}
              y2={PAD_TOP + innerH * (1 - f)}
              stroke="#e4e4e7"
              strokeWidth={1}
            />
          ))}

          <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
          <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {points.map(
            (p, i) =>
              i % labelStep === 0 && (
                <text key={i} x={p.x} y={HEIGHT - 8} fontSize={10} textAnchor="middle" fill="#a1a1aa">
                  {formatBucketLabel(p.bucket, granularity)}
                </text>
              ),
          )}

          {hovered && (
            <>
              <line x1={hovered.x} x2={hovered.x} y1={PAD_TOP} y2={PAD_TOP + innerH} stroke="#d4d4d8" strokeWidth={1} />
              <circle cx={hovered.x} cy={hovered.y} r={4} fill={color} stroke="white" strokeWidth={1.5} />
            </>
          )}
        </svg>
      )}

      {hovered && (
        <div className="-mt-1 flex w-fit items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs shadow-sm">
          <span className="font-medium text-zinc-700">{formatBucketLabel(hovered.bucket, granularity)}</span>
          <span className="font-mono font-semibold" style={{ color }}>
            {hovered.count.toLocaleString("vi-VN")}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowTable((v) => !v)}
        className="w-fit text-xs text-zinc-400 underline hover:text-zinc-600"
      >
        {showTable ? "Ẩn bảng dữ liệu" : "Xem dạng bảng"}
      </button>
      {showTable && (
        <div className="max-h-48 overflow-auto rounded-md border border-zinc-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-2 py-1">Thời điểm</th>
                <th className="px-2 py-1">Số lượng</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.bucket} className="border-t border-zinc-100">
                  <td className="px-2 py-1">{formatBucketLabel(d.bucket, granularity)}</td>
                  <td className="px-2 py-1 font-mono">{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
