import {
  Body,
  Controller,
  Delete,
  Ip,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DownloadLinksService } from './download-links.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateDownloadLinkDto } from './dto/update-download-link.dto';
import { DownloadRateLimitGuard } from './download-rate-limit.guard';

interface AuthUser {
  id: string;
  email: string;
}

// Thao tác theo đúng 1 link (sửa/xoá/mở khoá) — tách khỏi download-links.controller.ts
// (Controller('posts/:postId/download-links')) vì khác prefix, 1 class @Controller() chỉ nhận 1 path gốc.
@Controller('download-links')
export class DownloadLinkController {
  constructor(private readonly downloadLinksService: DownloadLinksService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)
  @Patch(':linkId')
  update(@Param('linkId') linkId: string, @Body() dto: UpdateDownloadLinkDto) {
    return this.downloadLinksService.updateLink(linkId, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)
  @Delete(':linkId')
  remove(@Param('linkId') linkId: string) {
    return this.downloadLinksService.deleteLink(linkId);
  }

  // DownloadRateLimitGuard chặn spam trước, PermissionsGuard chạy sau — thứ tự trong mảng UseGuards
  // là thứ tự thực thi thật của Nest, nên đặt rate-limit trước để chặn sớm nhất có thể.
  @UseGuards(DownloadRateLimitGuard, JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DOWNLOAD_PURCHASE)
  @Post(':linkId/unlock')
  unlock(
    @Param('linkId') linkId: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.downloadLinksService.unlock(user.id, linkId, ip);
  }
}
