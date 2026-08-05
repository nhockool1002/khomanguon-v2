import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LinkReportStatus } from '@prisma/client';
import { LinkReportsService } from './link-reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DownloadRateLimitGuard } from '../download-links/download-rate-limit.guard';
import { CreateLinkReportDto } from './dto/create-link-report.dto';
import { UpdateLinkReportStatusDto } from './dto/update-link-report-status.dto';

interface AuthUser {
  id: string;
  email: string;
}

@Controller('link-reports')
export class LinkReportsController {
  constructor(private readonly linkReportsService: LinkReportsService) {}

  // Cần JwtAuthGuard (không chỉ để chặn spam) — phải biết reporterId để gửi email xác nhận lại đúng
  // người báo cáo lúc Admin xử lý xong. Rate-limit tái dùng guard đã có sẵn cho tải file (cùng mức
  // rủi ro spam, UC25 vốn đã được nhắc tới trong comment của guard đó).
  @UseGuards(DownloadRateLimitGuard, JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLinkReportDto) {
    return this.linkReportsService.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)
  @Get()
  list(
    @Query('status') status?: LinkReportStatus,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.linkReportsService.listForModeration({
      status,
      q: q?.trim() || undefined,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)
  @Patch(':id/status')
  resolve(
    @Param('id') id: string,
    @Body() _dto: UpdateLinkReportStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.linkReportsService.resolve(id, user.id);
  }
}
