import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NewsletterService } from './newsletter.service';

// Cùng pattern "check-rồi-chạy mỗi phút" với db-backup-cron.service.ts/sepay-cron.service.ts —
// ngày/giờ/phút gửi đổi được qua Admin UI mà không cần đổi code/deploy lại.
@Injectable()
export class NewsletterCronService {
  private readonly logger = new Logger(NewsletterCronService.name);

  constructor(private readonly newsletterService: NewsletterService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleWeeklyDigest(): Promise<void> {
    const config = await this.newsletterService.getConfig();
    if (!config.enabled) return;

    const now = new Date();
    if (
      now.getDay() !== config.dayOfWeek ||
      now.getHours() !== config.hour ||
      now.getMinutes() !== config.minute
    ) {
      return;
    }

    // Chống gửi trùng nếu cron chạy nhiều lần trong đúng phút đó (lệch giờ hệ thống, restart...) —
    // đã gửi trong vòng chưa tới 1 ngày thì coi như "tuần này đã gửi rồi", bỏ qua.
    if (config.lastSentAt) {
      const hoursSinceLastSent =
        (now.getTime() - new Date(config.lastSentAt).getTime()) / 3_600_000;
      if (hoursSinceLastSent < 24) return;
    }

    this.logger.log('Bắt đầu gửi bản tin hàng tuần...');
    const result = await this.newsletterService.sendDigestNow();
    this.logger.log(
      `Gửi bản tin xong: ${result.sent} email, ${result.postCount} bài viết${result.skippedReason ? ` (${result.skippedReason})` : ''}.`,
    );
  }
}
