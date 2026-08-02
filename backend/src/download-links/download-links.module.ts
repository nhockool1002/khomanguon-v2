import { Module } from '@nestjs/common';
import { DownloadLinksService } from './download-links.service';
import { DownloadLinksController } from './download-links.controller';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [DownloadLinksController],
  providers: [DownloadLinksService],
  exports: [DownloadLinksService],
})
export class DownloadLinksModule {}
