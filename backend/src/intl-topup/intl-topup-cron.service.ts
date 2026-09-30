import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IntlTopupService } from './intl-topup.service';

// Chuyển EXPIRED các yêu cầu nạp quốc tế quá hạn thanh toán (chỉ AWAITING_PAYMENT) — hạn tính bằng
// giờ nên chạy 10 phút/lần là đủ, không cần mỗi phút như SepayCronService.
@Injectable()
export class IntlTopupCronService {
  private readonly logger = new Logger(IntlTopupCronService.name);

  constructor(private readonly intlTopupService: IntlTopupService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleExpire(): Promise<void> {
    const count = await this.intlTopupService.expireStaleOrders();
    if (count > 0) {
      this.logger.log(`Đã huỷ ${count} yêu cầu nạp quốc tế quá hạn`);
    }
  }
}
