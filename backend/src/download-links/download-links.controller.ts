import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { DownloadLinksService } from './download-links.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CreateDownloadLinkDto } from './dto/create-download-link.dto';

// List/tạo mới theo post — thao tác theo linkId cụ thể (sửa/xoá/mở khoá) nằm ở
// download-link.controller.ts (Controller('download-links'), khác prefix nên phải tách class).
@Controller('posts/:postId/download-links')
export class DownloadLinksController {
  constructor(private readonly downloadLinksService: DownloadLinksService) {}

  // Công khai — không còn phụ thuộc user hiện tại (đã bỏ hasAccess, mỗi lượt tải luôn trừ $P).
  // Dùng chung cho cả DownloadBox (public) lẫn DownloadConfigPanel (admin, chỉ cần đọc lại để
  // prefill form) — đúng pattern route đơn cũ, không tách riêng route admin không cần thiết.
  @Get()
  getPublicList(@Param('postId') postId: string) {
    return this.downloadLinksService.getPublicList(postId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)
  @Post()
  create(@Param('postId') postId: string, @Body() dto: CreateDownloadLinkDto) {
    return this.downloadLinksService.createForPost(postId, dto);
  }
}
