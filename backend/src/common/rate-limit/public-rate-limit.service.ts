import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_GENERAL_SETTINGS,
  GENERAL_SETTINGS_KEY,
  type RateLimitSettings,
} from '../../settings/site-settings.types';
import type { RateLimitName } from './rate-limit-key.decorator';

// Đọc thẳng PrismaService (Global) thay vì import SiteSettingsModule/Service — SiteSettingsModule
// import AuthModule (cho guard), nếu module này lại import SiteSettingsModule thì AuthModule ->
// (module này) -> SiteSettingsModule -> AuthModule tạo circular dependency. Chỉ cần đọc đúng 1 JSON
// key nên không đáng phải kéo cả SiteSettingsService vào.
const CONFIG_CACHE_MS = 30_000; // chấp nhận admin đổi ngưỡng có độ trễ áp dụng tối đa 30s

// Sliding-window rate limit trong bộ nhớ, cùng kỹ thuật DownloadRateLimitGuard nhưng tổng quát hoá
// cho nhiều route công khai (login/register/forgot-password/search/comment) với ngưỡng cấu hình được
// qua /admin/settings/general thay vì hard-code — Global() nên chỉ 1 instance/bộ đếm dùng chung cho
// toàn app (không cần Redis, giống lý do đã ghi ở download-rate-limit.guard.ts).
@Injectable()
export class PublicRateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  private cachedConfig: RateLimitSettings = DEFAULT_GENERAL_SETTINGS.rateLimits;
  private cachedAt = 0;
  private readonly hits = new Map<string, number[]>();

  private async getConfig(): Promise<RateLimitSettings> {
    const now = Date.now();
    if (now - this.cachedAt < CONFIG_CACHE_MS) return this.cachedConfig;

    const row = await this.prisma.siteSetting.findUnique({
      where: { key: GENERAL_SETTINGS_KEY },
    });
    const stored = (row?.value as { rateLimits?: RateLimitSettings } | null)
      ?.rateLimits;
    // Merge nông với default thay vì dùng thẳng `stored` — dữ liệu production lưu TRƯỚC khi thêm 1
    // key rateLimits mới (vd feedbackCreate) sẽ thiếu key đó cho tới khi Admin bấm Lưu lại ở trang
    // Cài đặt chung; không merge thì check(key) bên dưới đọc `rule.windowSec` trên `undefined` -> lỗi
    // 500 cho toàn bộ route dùng key mới đó.
    this.cachedConfig = stored
      ? { ...DEFAULT_GENERAL_SETTINGS.rateLimits, ...stored }
      : DEFAULT_GENERAL_SETTINGS.rateLimits;
    this.cachedAt = now;
    return this.cachedConfig;
  }

  async check(key: RateLimitName, ip: string): Promise<void> {
    const config = await this.getConfig();
    if (!config.enabled) return;

    const rule = config[key];
    const mapKey = `${key}:${ip}`;
    const now = Date.now();
    const windowMs = rule.windowSec * 1000;

    const timestamps = (this.hits.get(mapKey) ?? []).filter(
      (t) => now - t < windowMs,
    );
    if (timestamps.length >= rule.max) {
      this.hits.set(mapKey, timestamps);
      throw new HttpException(
        'Bạn thao tác quá nhanh — vui lòng thử lại sau.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    timestamps.push(now);
    this.hits.set(mapKey, timestamps);

    // Tự dọn key đã hết hoạt động — tránh Map phình vô hạn (không có TTL tự nhiên như Redis).
    if (this.hits.size > 5000) {
      for (const [k, arr] of this.hits) {
        const alive = arr.filter((t) => now - t < windowMs);
        if (alive.length === 0) this.hits.delete(k);
        else this.hits.set(k, alive);
      }
    }
  }
}
