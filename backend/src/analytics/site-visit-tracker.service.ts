import { Injectable } from '@nestjs/common';

const WINDOW_MS = 30 * 60_000; // 1 "lượt truy cập" = 1 phiên 30 phút/identity, cùng ngưỡng với
// PostViewTrackerService (post-view-tracker.service.ts) — không đếm lại mỗi lần chuyển trang trong
// cùng phiên duyệt, chỉ đếm 1 lần khi identity đó quay lại sau khi phiên cũ đã "nguội".

// Chống đếm trùng "lượt truy cập" khi 1 người duyệt nhiều trang/F5 liên tục trong cùng phiên — cùng
// pattern Map trong bộ nhớ như PostViewTrackerService (chấp nhận đếm lại từ đầu sau mỗi lần
// deploy/restart, không cần Redis ở quy mô hiện tại).
@Injectable()
export class SiteVisitTrackerService {
  private readonly seen = new Map<string, number>();

  shouldCount(identity: string): boolean {
    const now = Date.now();
    const last = this.seen.get(identity);
    if (last !== undefined && now - last < WINDOW_MS) return false;
    this.seen.set(identity, now);

    if (this.seen.size > 20_000) {
      for (const [k, ts] of this.seen) {
        if (now - ts >= WINDOW_MS) this.seen.delete(k);
      }
    }
    return true;
  }
}
