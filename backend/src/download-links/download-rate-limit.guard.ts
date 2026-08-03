import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

// Rate limit lượt tải/IP (PLAN.md 3.5, UC24/UC25) — sliding window trong bộ nhớ, không cần
// Redis/thư viện ngoài vì hiện chỉ chạy 1 instance backend (docker-compose không chạy nhiều
// replica, xem comment tương tự ở realtime/wallet.gateway.ts). Nếu scale ngang nhiều instance sau
// này, phải chuyển sang lưu ở Redis để đếm đúng across instances.
@Injectable()
export class DownloadRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip ?? 'unknown';
    const now = Date.now();

    const timestamps = (this.hits.get(ip) ?? []).filter(
      (t) => now - t < WINDOW_MS,
    );
    if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      this.hits.set(ip, timestamps);
      throw new HttpException(
        'Bạn tải quá nhanh — vui lòng thử lại sau 1 phút.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    timestamps.push(now);
    this.hits.set(ip, timestamps);

    // Tự dọn IP đã hết hoạt động — tránh Map phình vô hạn theo thời gian (chỉ chạy 1 instance nên
    // Map này sống suốt vòng đời process, không có TTL tự nhiên như Redis).
    if (this.hits.size > 5000) {
      for (const [key, arr] of this.hits) {
        const alive = arr.filter((t) => now - t < WINDOW_MS);
        if (alive.length === 0) this.hits.delete(key);
        else this.hits.set(key, alive);
      }
    }
    return true;
  }
}
