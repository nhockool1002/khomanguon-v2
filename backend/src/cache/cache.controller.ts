import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CacheService } from './cache.service';
import { FrontendRevalidateService } from './frontend-revalidate.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';

@Controller('admin/cache')
export class CacheController {
  constructor(
    private readonly cache: CacheService,
    private readonly frontendRevalidate: FrontendRevalidateService,
  ) {}

  // Nút "Xoá cache" trên topbar (chỉ hiện với user có quyền cache.manage — mặc định chỉ Admin,
  // xem permissions.constant.ts) — dọn object cache Redis + purge cache trang Next.js bên frontend.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.CACHE_MANAGE)
  @HttpCode(200)
  @Post('clear')
  async clear() {
    const [redisKeysCleared, frontendRevalidated] = await Promise.all([
      this.cache.clearAll(),
      this.frontendRevalidate.revalidateAll(),
    ]);
    return {
      redisKeysCleared,
      frontendRevalidated,
      clearedAt: new Date().toISOString(),
    };
  }
}
