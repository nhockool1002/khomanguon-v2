import { SetMetadata } from '@nestjs/common';
import type { RateLimitSettings } from '../../settings/site-settings.types';

export const RATE_LIMIT_KEY = 'rateLimitKey';

export type RateLimitName = Exclude<keyof RateLimitSettings, 'enabled'>;

// Đánh dấu 1 route công khai cần rate-limit theo ngưỡng đã cấu hình ở Cài đặt chung (GeneralSettings
// .rateLimits) — PublicRateLimitGuard đọc metadata này để biết dùng đúng ngưỡng nào.
export const RateLimitKey = (key: RateLimitName) =>
  SetMetadata(RATE_LIMIT_KEY, key);
