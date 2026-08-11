import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionCronService } from './subscription-cron.service';
import { AuthModule } from '../auth/auth.module';
import { SepayModule } from '../sepay/sepay.module';
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module';

@Module({
  imports: [AuthModule, SepayModule, SubscriptionPlansModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, SubscriptionCronService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
