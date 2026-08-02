import { Module } from '@nestjs/common';
import { SepayService } from './sepay.service';
import { SepayWebhookController } from './sepay-webhook.controller';
import { SepayConfigController } from './sepay-config.controller';
import { SepayCronService } from './sepay-cron.service';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [SepayWebhookController, SepayConfigController],
  providers: [SepayService, SepayCronService],
  exports: [SepayService],
})
export class SepayModule {}
