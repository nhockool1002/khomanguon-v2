import { Injectable } from '@nestjs/common';

const WINDOW_MS = 30 * 60_000; // 30 phút — đủ chặn F5 spam, không cần chính xác tuyệt đối

// Chống đếm trùng viewCount khi cùng 1 người F5 liên tục — Map trong bộ nhớ, cùng pattern đã có ở
// download-rate-limit.guard.ts (chấp nhận: 1 instance backend, không cần Redis; sẽ đếm lại từ đầu
// sau mỗi lần deploy/restart — đánh đổi chấp nhận được, giống hệt rate limit tải file). Key ưu tiên
// userId (nếu đăng nhập) thay vì IP để tránh nhiều người chung IP (NAT/mạng công ty) bị đếm hụt.
@Injectable()
export class PostViewTrackerService {
  private readonly seen = new Map<string, number>();

  shouldCount(postId: string, identity: string): boolean {
    const key = `${postId}:${identity}`;
    const now = Date.now();
    const last = this.seen.get(key);
    if (last !== undefined && now - last < WINDOW_MS) return false;
    this.seen.set(key, now);

    // Tự dọn định kỳ — tránh Map phình vô hạn theo thời gian (không có TTL tự nhiên như Redis).
    if (this.seen.size > 5000) {
      for (const [k, ts] of this.seen) {
        if (now - ts >= WINDOW_MS) this.seen.delete(k);
      }
    }
    return true;
  }
}
