import { Body, Controller, Get, Headers, Ip, Post, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { SiteVisitTrackerService } from './site-visit-tracker.service';
import { isBotUserAgent } from './bot-detector';
import { TrackVisitDto } from './dto/track-visit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface AuthUser {
  id: string;
  email: string;
}

// Mặc định 30 ngày gần nhất nếu FE không truyền from/to (không nên xảy ra — trang Dashboard luôn
// gửi kèm quick filter — nhưng vẫn cần giá trị an toàn để endpoint không vỡ khi gọi tay/test).
function parseRange(from?: string, to?: string): { from: Date; to: Date } {
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 30 * 86_400_000);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate >= toDate) {
    const safeTo = new Date();
    return { from: new Date(safeTo.getTime() - 30 * 86_400_000), to: safeTo };
  }
  return { from: fromDate, to: toDate };
}

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly tracker: SiteVisitTrackerService,
  ) {}

  // Public — trình duyệt bắn 1 request mỗi lần chuyển trang (xem components/visit-tracker.tsx).
  // Không gắn PublicRateLimitGuard (giống hệt POST /posts/:id/view) — chặn spam chủ yếu dựa vào
  // SiteVisitTrackerService dedup theo identity trong 30 phút, không phải rate limit theo request.
  @UseGuards(OptionalJwtAuthGuard)
  @Post('track')
  async track(
    @Body() dto: TrackVisitDto,
    @CurrentUser() user: AuthUser | undefined,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    // Bỏ qua bot/crawler và chính trang quản trị (Admin thao tác trong /admin không tính là "khách
    // truy cập site") — giữ số liệu Dashboard đúng với traffic thật của độc giả.
    if (isBotUserAgent(userAgent) || dto.path.startsWith('/admin')) return { ok: true };

    const identity = user?.id ?? ip;
    if (this.tracker.shouldCount(identity)) {
      await this.analytics.recordVisit(dto.path, dto.referrer, user?.id);
    }
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.ANALYTICS_VIEW)
  @Get('overview')
  overview(@Query('from') from?: string, @Query('to') to?: string) {
    const { from: fromDate, to: toDate } = parseRange(from, to);
    return this.analytics.getOverview(fromDate, toDate);
  }
}
