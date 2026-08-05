import { Module } from '@nestjs/common';
import { LinkReportsService } from './link-reports.service';
import { LinkReportsController } from './link-reports.controller';
import { AuthModule } from '../auth/auth.module';
import { DownloadRateLimitGuard } from '../download-links/download-rate-limit.guard';

// DownloadRateLimitGuard không có dependency (chỉ Map trong bộ nhớ) nên khai báo lại 1 instance
// riêng ở đây thay vì import cả DownloadLinksModule — 2 bộ đếm riêng biệt (1 cho tải file, 1 cho
// báo lỗi link) còn đúng hơn dùng chung 1 bộ đếm cho 2 hành động khác nhau về bản chất.
@Module({
  imports: [AuthModule],
  controllers: [LinkReportsController],
  providers: [LinkReportsService, DownloadRateLimitGuard],
})
export class LinkReportsModule {}
