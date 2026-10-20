import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ExtensionSyncService } from './extension-sync.service';
import { SyncBookmarksDto } from './dto/sync-bookmarks.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { PERMISSIONS } from '../roles/permissions.constant';
import { ApiClientGuard } from '../common/guards/api-client.guard';

interface AuthUser {
  id: string;
  email: string;
}

// API cho K-Extension đồng bộ cây bookmark/folder/note theo tài khoản khomanguon.org của user
// (khác hẳn BookmarksController — đó là "bài viết đã lưu" trên site). 3 lớp guard độc lập:
// ApiClientGuard xác nhận request tới từ đúng extension, JwtAuthGuard xác định user,
// PermissionsGuard chặn user chưa kích hoạt (UNVERIFIED không có ext_bookmark.sync).
// PermissionsGuard đọc metadata @Permissions() qua context.getHandler() — chỉ nhận ở cấp
// method, đặt ở cấp class sẽ bị bỏ qua lặng lẽ (required rỗng -> cho qua hết, xem
// roles/guards/permissions.guard.ts). Phải lặp lại @UseGuards/@Permissions trên từng handler,
// đúng convention đang dùng ở WidgetsController/SlidersController...
@Controller('extension-sync/bookmarks')
export class ExtensionSyncController {
  constructor(private readonly service: ExtensionSyncService) {}

  @UseGuards(ApiClientGuard, JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.EXT_BOOKMARK_SYNC)
  @Get()
  getMine(@CurrentUser() user: AuthUser) {
    return this.service.getMine(user.id);
  }

  @UseGuards(ApiClientGuard, JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.EXT_BOOKMARK_SYNC)
  @Put()
  saveMine(@CurrentUser() user: AuthUser, @Body() dto: SyncBookmarksDto) {
    return this.service.saveMine(user.id, dto.data);
  }
}
