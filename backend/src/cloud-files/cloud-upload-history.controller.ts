import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CloudUploadHistoryService } from './cloud-upload-history.service';
import { CreateCloudUploadRecordDto } from './dto/create-cloud-upload-record.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';

// Tách khỏi CloudFilesController (prefix "storage-providers/:id/files") vì đây không gắn với 1
// provider cụ thể — cùng lý do đã tách DownloadLinkController khỏi DownloadLinksController.
@Controller('cloud-files/upload-history')
export class CloudUploadHistoryController {
  constructor(private readonly historyService: CloudUploadHistoryService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)
  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateCloudUploadRecordDto,
  ) {
    return this.historyService.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)
  @Get()
  list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.historyService.list(Number(page) || 1, Number(limit) || 20);
  }
}
