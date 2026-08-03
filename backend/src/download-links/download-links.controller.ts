import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { DownloadLinksService } from './download-links.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpsertDownloadLinkDto } from './dto/upsert-download-link.dto';
import { DownloadRateLimitGuard } from './download-rate-limit.guard';

interface AuthUser {
  id: string;
  email: string;
}

@Controller('posts/:postId/download-link')
export class DownloadLinksController {
  constructor(private readonly downloadLinksService: DownloadLinksService) {}

  // Công khai — không còn phụ thuộc user hiện tại (đã bỏ hasAccess, mỗi lượt tải luôn trừ $P).
  @Get()
  getPublic(@Param('postId') postId: string) {
    return this.downloadLinksService.getPublicInfo(postId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)
  @Put()
  upsert(@Param('postId') postId: string, @Body() dto: UpsertDownloadLinkDto) {
    return this.downloadLinksService.upsertForPost(postId, dto);
  }

  // DownloadRateLimitGuard chặn spam trước, PermissionsGuard chạy sau — thứ tự trong mảng UseGuards
  // là thứ tự thực thi thật của Nest, nên đặt rate-limit trước để chặn sớm nhất có thể.
  @UseGuards(DownloadRateLimitGuard, JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DOWNLOAD_PURCHASE)
  @Post('unlock')
  unlock(
    @Param('postId') postId: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.downloadLinksService.unlock(user.id, postId, ip);
  }
}
