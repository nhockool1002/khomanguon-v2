import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { SiteVisitTrackerService } from './site-visit-tracker.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, SiteVisitTrackerService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
