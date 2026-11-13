"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { AnalyticsOverview } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { ReferrerBarChart } from "@/components/charts/referrer-bar-chart";

type Preset = "today" | "6m" | "1y" | "2y" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Hôm nay" },
  { key: "6m", label: "6 tháng" },
  { key: "1y", label: "1 năm" },
  { key: "2y", label: "2 năm" },
];

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Tính [from, to) theo preset — "to" luôn là thời điểm hiện tại (dữ liệu tính tới lúc xem), riêng
// "today" lấy từ 00:00 hôm nay để biểu đồ theo giờ có đủ điểm từ đầu ngày.
function rangeFromPreset(preset: Preset, customFrom: string, customTo: string): { from: Date; to: Date } {
  const now = new Date();
  if (preset === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start, to: now };
  }
  if (preset === "6m") return { from: new Date(now.getTime() - 182 * 86_400_000), to: now };
  if (preset === "1y") return { from: new Date(now.getTime() - 365 * 86_400_000), to: now };
  if (preset === "2y") return { from: new Date(now.getTime() - 2 * 365 * 86_400_000), to: now };
  // custom — "to" lấy hết ngày đã chọn (23:59:59) để không hụt mất dữ liệu trong ngày cuối.
  const from = customFrom ? new Date(`${customFrom}T00:00:00`) : new Date(now.getTime() - 30 * 86_400_000);
  const to = customTo ? new Date(`${customTo}T23:59:59.999`) : now;
  return { from, to };
}

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]";

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="text-2xl font-bold text-zinc-900">{value.toLocaleString("vi-VN")}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState(() => toDateInputValue(new Date(Date.now() - 30 * 86_400_000)));
  const [customTo, setCustomTo] = useState(() => toDateInputValue(new Date()));
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const { from, to } = useMemo(() => rangeFromPreset(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const reload = useCallback(() => {
    const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    apiFetch<AnalyticsOverview>(`/analytics/overview?${query.toString()}`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, [from, to]);

  useEffect(() => {
    if (!user) return;
    reload();
  }, [user, reload]);

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.ANALYTICS_VIEW)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full flex-col gap-5 px-4 py-6 sm:px-8 sm:py-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Dashboard thống kê truy cập</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Số liệu đã lọc bot/crawler và chống đếm trùng F5 trong cùng phiên 30 phút — phản ánh đúng
          lượt khách thật ghé site, không bao gồm thao tác trong trang quản trị.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-white p-3">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              preset === p.key ? "bg-[#1d3557] text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-zinc-200" />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              setPreset("custom");
            }}
            className={inputClass}
          />
          <span className="text-xs text-zinc-400">đến</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => {
              setCustomTo(e.target.value);
              setPreset("custom");
            }}
            className={inputClass}
          />
        </div>
      </div>

      {!data ? (
        <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải số liệu...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <StatTile label="Tổng lượt truy cập" value={data.totalVisits} />
            <StatTile label="Tổng lượt xem bài viết" value={data.totalPostViews} />
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <TimeSeriesChart
              data={data.visitsSeries}
              granularity={data.granularity}
              color="#1d3557"
              label="Lượt truy cập website"
            />
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <TimeSeriesChart
              data={data.postViewsSeries}
              granularity={data.granularity}
              color="#db2777"
              label="Lượt xem bài viết"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="mb-3 text-sm font-medium text-zinc-700">Nguồn đến trước khi truy cập</p>
              <ReferrerBarChart data={data.referrerBreakdown} />
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="mb-3 text-sm font-medium text-zinc-700">Bài viết xem nhiều nhất</p>
              {data.topPosts.length === 0 ? (
                <p className="text-sm text-zinc-400">Chưa có dữ liệu.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {data.topPosts.map((p, i) => (
                    <li key={p.postId} className="flex items-center gap-2 text-sm">
                      <span className="w-5 flex-none text-right text-xs text-zinc-400">{i + 1}.</span>
                      {p.slug ? (
                        <Link
                          href={`/bai-viet/${p.slug}`}
                          target="_blank"
                          className="flex-1 truncate text-zinc-700 hover:underline"
                        >
                          {p.title}
                        </Link>
                      ) : (
                        <span className="flex-1 truncate text-zinc-400">{p.title}</span>
                      )}
                      <span className="flex-none font-mono text-xs text-zinc-500">
                        {p.count.toLocaleString("vi-VN")}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
