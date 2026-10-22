import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MemberDigestTrigger } from '@prisma/client';
import { MemberDigestService } from './member-digest.service';

// 2 cron tách biệt, cùng pattern "check-rồi-chạy mỗi phút" với newsletter-cron.service.ts/
// db-backup-cron.service.ts — nhưng ở đây tách TẠO batch (checkSchedule) khỏi GỬI batch
// (processQueue) vì gửi hết 1 batch lớn có thể mất nhiều phút (hàng đợi lưu DB, xem
// member-digest.service.ts processNextChunk()), không thể gửi xong trong đúng 1 lần tick.
@Injectable()
export class MemberDigestCronService {
  private readonly logger = new Logger(MemberDigestCronService.name);

  constructor(private readonly memberDigestService: MemberDigestService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkSchedule(): Promise<void> {
    const config = await this.memberDigestService.getConfig();
    if (!config.enabled) return;

    const now = new Date();
    if (
      now.getDay() !== config.dayOfWeek ||
      now.getHours() !== config.hour ||
      now.getMinutes() !== config.minute
    ) {
      return;
    }

    // Chống tạo batch trùng nếu cron chạy nhiều lần trong đúng phút đó (lệch giờ hệ thống,
    // restart...) — đã tạo batch trong vòng chưa tới 1 ngày thì coi như "tuần này đã gửi rồi".
    if (config.lastSentAt) {
      const hoursSinceLastSent =
        (now.getTime() - new Date(config.lastSentAt).getTime()) / 3_600_000;
      if (hoursSinceLastSent < 24) return;
    }

    this.logger.log('Bắt đầu tạo batch digest thành viên...');
    const result = await this.memberDigestService.createBatchIfDue(
      MemberDigestTrigger.CRON,
    );
    this.logger.log(
      result.batchId
        ? `Đã tạo batch #${result.batchId}: ${result.totalRecipients} người nhận.`
        : `Bỏ qua: ${result.skippedReason}`,
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processQueue(): Promise<void> {
    const result = await this.memberDigestService.processNextChunk();
    if (result.processed > 0) {
      this.logger.log(`Đã xử lý ${result.processed} email trong hàng đợi.`);
    }
  }
}
