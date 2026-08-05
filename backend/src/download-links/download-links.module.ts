import { Module } from '@nestjs/common';
import { DownloadLinksService } from './download-links.service';
import { DownloadLinksController } from './download-links.controller';
import { DownloadLinkController } from './download-link.controller';
import { DownloadRateLimitGuard } from './download-rate-limit.guard';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [AuthModule, StorageModule, RealtimeModule],
  controllers: [DownloadLinksController, DownloadLinkController],
  providers: [DownloadLinksService, DownloadRateLimitGuard],
  exports: [DownloadLinksService],
})
export class DownloadLinksModule {}
