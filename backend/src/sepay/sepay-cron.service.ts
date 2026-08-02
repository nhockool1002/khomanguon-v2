import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SepayService } from './sepay.service';

// Huỷ (EXPIRED) các yêu cầu nạp tiền "pending" quá hạn 30 phút — PLAN.md Phase 3.2.
@Injectable()
export class SepayCronService {
  private readonly logger = new Logger(SepayCronService.name);

  constructor(private readonly sepayService: SepayService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpirePendingOrders(): Promise<void> {
    const count = await this.sepayService.expirePendingOrders();
    if (count > 0) {
      this.logger.log(`Đã huỷ ${count} yêu cầu nạp tiền quá hạn`);
    }
  }
}
