import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionService } from './subscription.service';

// Cùng pattern "sweep mỗi phút, không cần cấu hình giờ" với sepay-cron.service.ts
// (expirePendingOrders) — hết hạn thì gỡ role ngay trong vòng tối đa 1 phút, không cần Admin bật gì.
@Injectable()
export class SubscriptionCronService {
  private readonly logger = new Logger(SubscriptionCronService.name);

  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiry(): Promise<void> {
    const count = await this.subscriptionService.expireEndedMemberships();
    if (count > 0) {
      this.logger.log(
        `Đã hết hạn ${count} kỳ Subscription, gỡ role tương ứng.`,
      );
    }
  }
}
