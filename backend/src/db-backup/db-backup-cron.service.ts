import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DbBackupService } from './db-backup.service';

// Cùng pattern "check-rồi-chạy mỗi phút" đã có ở sepay-cron.service.ts (EVERY_MINUTE thay vì cron
// expression cố định theo giờ:phút cấu hình — giờ/phút backup đổi được qua Admin UI mà không cần
// đổi code/deploy lại).
@Injectable()
export class DbBackupCronService {
  private readonly logger = new Logger(DbBackupCronService.name);

  constructor(private readonly dbBackupService: DbBackupService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledBackup(): Promise<void> {
    const config = await this.dbBackupService.getConfig();
    if (!config.enabled || !config.storageProviderId) return;

    const now = new Date();
    if (now.getHours() !== config.hour || now.getMinutes() !== config.minute)
      return;

    if (await this.dbBackupService.hasRunToday()) return;

    this.logger.log('Bắt đầu backup DB theo lịch...');
    await this.dbBackupService.runBackup();
  }
}
