import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Granularity = 'hour' | 'day' | 'week' | 'month';

export interface SeriesPoint {
  bucket: string; // ISO string — mốc BẮT ĐẦU của khoảng (giờ/ngày/tuần/tháng tuỳ granularity)
  count: number;
}

export interface ReferrerSlice {
  source: string;
  count: number;
}

export interface TopPost {
  postId: string;
  title: string;
  slug: string;
  count: number;
}

export interface AnalyticsOverview {
  from: string;
  to: string;
  granularity: Granularity;
  totalVisits: number;
  totalPostViews: number;
  visitsSeries: SeriesPoint[];
  postViewsSeries: SeriesPoint[];
  referrerBreakdown: ReferrerSlice[];
  topPosts: TopPost[];
}

// Nhóm hiển thị nguồn đến — khớp theo substring hostname (không phân biệt hoa thường), ưu tiên nhóm
// nào khớp trước trong danh sách. Không khớp nhóm nào -> "Khác" (gộp chung, tránh biểu đồ vỡ vụn vì
// hàng chục domain referrer lẻ tẻ chỉ 1-2 lượt).
const REFERRER_GROUPS: { label: string; test: (host: string) => boolean }[] = [
  { label: 'Google', test: (h) => h.includes('google') },
  { label: 'Facebook', test: (h) => h.includes('facebook') || h.includes('fb.com') || h.includes('fb.me') },
  { label: 'Zalo', test: (h) => h.includes('zalo') },
  { label: 'YouTube', test: (h) => h.includes('youtube') || h.includes('youtu.be') },
  { label: 'TikTok', test: (h) => h.includes('tiktok') },
  { label: 'Bing', test: (h) => h.includes('bing') },
  { label: 'Cốc Cốc', test: (h) => h.includes('coccoc') },
  { label: 'Telegram', test: (h) => h.includes('t.me') || h.includes('telegram') },
];

function categorizeReferrer(host: string | null): string {
  if (!host) return 'Trực tiếp';
  const h = host.toLowerCase();
  const group = REFERRER_GROUPS.find((g) => g.test(h));
  return group ? group.label : 'Khác';
}

// Khoảng càng dài thì gộp mốc thời gian càng thô — tránh biểu đồ 2 năm có 17,520 điểm giờ (vừa vô
// nghĩa vừa nặng), đồng thời "Hôm nay" vẫn thấy biến động theo giờ chứ không phải 1 điểm duy nhất.
function pickGranularity(from: Date, to: Date): Granularity {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days <= 2) return 'hour';
  if (days <= 92) return 'day';
  if (days <= 400) return 'week';
  return 'month';
}

function floorToBucket(date: Date, granularity: Granularity): Date {
  const d = new Date(date);
  if (granularity === 'hour') {
    d.setMinutes(0, 0, 0);
    return d;
  }
  d.setHours(0, 0, 0, 0);
  if (granularity === 'day') return d;
  if (granularity === 'week') {
    const day = d.getDay(); // 0 = Chủ nhật
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diffToMonday);
    return d;
  }
  d.setDate(1); // month
  return d;
}

function nextBucket(date: Date, granularity: Granularity): Date {
  const d = new Date(date);
  if (granularity === 'hour') d.setHours(d.getHours() + 1);
  else if (granularity === 'day') d.setDate(d.getDate() + 1);
  else if (granularity === 'week') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

// Sinh đủ các mốc liên tục trong [from, to] kể cả mốc 0 lượt — biểu đồ phải phản ánh đúng khoảng
// trống thật sự (không truy cập) thay vì "nhảy cóc" khiến Admin hiểu nhầm là thiếu dữ liệu.
function bucketize(dates: Date[], granularity: Granularity, from: Date, to: Date): SeriesPoint[] {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const key = floorToBucket(date, granularity).toISOString();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const series: SeriesPoint[] = [];
  const end = floorToBucket(to, granularity);
  let cursor = floorToBucket(from, granularity);
  // Chặn an toàn — tối đa ~5000 điểm (vd granularity 'hour' lỡ nhận khoảng vài năm) để không treo
  // vòng lặp nếu caller truyền from/to bất thường.
  let guard = 0;
  while (cursor.getTime() <= end.getTime() && guard < 5000) {
    const key = cursor.toISOString();
    series.push({ bucket: key, count: counts.get(key) ?? 0 });
    cursor = nextBucket(cursor, granularity);
    guard++;
  }
  return series;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // path tối đa 500 ký tự khớp DTO/cột DB — cắt phòng hờ nếu validation đổi sau này.
  async recordVisit(path: string, referrer: string | undefined, userId: string | undefined) {
    await this.prisma.siteVisit.create({
      data: {
        path: path.slice(0, 500),
        referrerHost: this.parseReferrerHost(referrer),
        userId,
      },
    });
  }

  private parseReferrerHost(referrer: string | undefined): string | null {
    if (!referrer) return null;
    try {
      const url = new URL(referrer);
      const frontendHost = new URL(process.env.FRONTEND_URL ?? 'http://localhost:3000').host;
      if (url.host === frontendHost) return null; // referrer là chính site mình -> coi như trực tiếp
      return url.host;
    } catch {
      return null; // referrer không phải URL hợp lệ -> coi như trực tiếp, không quăng lỗi
    }
  }

  async getOverview(from: Date, to: Date): Promise<AnalyticsOverview> {
    const granularity = pickGranularity(from, to);
    const where = { createdAt: { gte: from, lt: to } };

    const [visits, postViews] = await Promise.all([
      this.prisma.siteVisit.findMany({ where, select: { createdAt: true, referrerHost: true } }),
      this.prisma.postViewLog.findMany({ where, select: { createdAt: true, postId: true } }),
    ]);

    const visitsSeries = bucketize(visits.map((v) => v.createdAt), granularity, from, to);
    const postViewsSeries = bucketize(postViews.map((v) => v.createdAt), granularity, from, to);

    const referrerCounts = new Map<string, number>();
    for (const v of visits) {
      const label = categorizeReferrer(v.referrerHost);
      referrerCounts.set(label, (referrerCounts.get(label) ?? 0) + 1);
    }
    const referrerBreakdown: ReferrerSlice[] = [...referrerCounts.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    const postCounts = new Map<string, number>();
    for (const v of postViews) postCounts.set(v.postId, (postCounts.get(v.postId) ?? 0) + 1);
    const topPostIds = [...postCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const posts =
      topPostIds.length > 0
        ? await this.prisma.post.findMany({
            where: { id: { in: topPostIds.map(([id]) => id) } },
            select: { id: true, title: true, slug: true },
          })
        : [];
    const postById = new Map(posts.map((p) => [p.id, p]));
    const topPosts: TopPost[] = topPostIds.map(([postId, count]) => ({
      postId,
      title: postById.get(postId)?.title ?? '(Bài viết đã xoá)',
      slug: postById.get(postId)?.slug ?? '',
      count,
    }));

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      granularity,
      totalVisits: visits.length,
      totalPostViews: postViews.length,
      visitsSeries,
      postViewsSeries,
      referrerBreakdown,
      topPosts,
    };
  }
}
