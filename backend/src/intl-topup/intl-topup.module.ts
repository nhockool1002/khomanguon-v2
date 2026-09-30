import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SepayModule } from '../sepay/sepay.module';
import { SiteSettingsModule } from '../settings/site-settings.module';
import { IntlTopupController } from './intl-topup.controller';
import { IntlTopupService } from './intl-topup.service';
import { IntlTopupInvoiceService } from './intl-topup-invoice.service';
import { IntlTopupCronService } from './intl-topup-cron.service';

// SepayModule chỉ để ĐỌC tỉ giá cơ bản VNĐ/$P (SepayService.getTopupPresets) — không gọi gì khác.
@Module({
  imports: [AuthModule, RealtimeModule, SepayModule, SiteSettingsModule],
  controllers: [IntlTopupController],
  providers: [IntlTopupService, IntlTopupInvoiceService, IntlTopupCronService],
})
export class IntlTopupModule {}
