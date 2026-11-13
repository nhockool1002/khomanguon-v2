export interface ReferrerSlice {
  source: string;
  count: number;
}

// Màu cố định THEO TÊN nguồn (không theo thứ tự/index) — giữ đúng 1 màu cho "Google" dù dữ liệu kỳ
// này sắp xếp khác kỳ trước (tránh đổi màu gây hiểu nhầm khi filter đổi). "Khác"/"Trực tiếp" dùng
// tông trung tính để không lẫn với các nguồn có thương hiệu.
const COLOR_BY_SOURCE: Record<string, string> = {
  "Trực tiếp": "#94a3b8",
  Google: "#2563eb",
  Facebook: "#db2777",
  Zalo: "#16a34a",
  YouTube: "#ea580c",
  TikTok: "#7c3aed",
  Bing: "#0891b2",
  "Cốc Cốc": "#ca8a04",
  Telegram: "#0ea5e9",
  Khác: "#cbd5e1",
};
const FALLBACK_COLOR = "#a1a1aa";

// Biểu đồ cột ngang — mỗi cột LUÔN kèm nhãn tên nguồn + số liệu bằng chữ (không chỉ dựa vào màu),
// nên không cần chú giải (legend) riêng. Tự vẽ bằng div/flexbox (không phải SVG) — đơn giản hơn cho
// dạng cột ngang có nhãn dài, không cần thư viện chart.
export function ReferrerBarChart({ data }: { data: ReferrerSlice[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const max = Math.max(1, ...data.map((d) => d.count));

  if (data.length === 0 || total === 0) {
    return <div className="flex h-32 items-center justify-center text-sm text-zinc-400">Chưa có dữ liệu.</div>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d) => {
        const pct = (d.count / max) * 100;
        const share = total > 0 ? Math.round((d.count / total) * 100) : 0;
        const color = COLOR_BY_SOURCE[d.source] ?? FALLBACK_COLOR;
        return (
          <div key={d.source} className="flex items-center gap-3 text-sm">
            <span className="w-24 flex-none truncate text-zinc-600">{d.source}</span>
            <div className="h-5 flex-1 overflow-hidden rounded bg-zinc-100">
              <div
                className="h-full rounded transition-all"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span className="w-24 flex-none text-right font-mono text-xs text-zinc-500">
              {d.count.toLocaleString("vi-VN")} ({share}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}
