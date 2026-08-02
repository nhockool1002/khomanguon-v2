import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CloudFilesService } from './cloud-files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';

@Controller('storage-providers/:id/files')
export class CloudFilesController {
  constructor(private readonly cloudFilesService: CloudFilesService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)
  @Get()
  list(@Param('id') id: string, @Query('prefix') prefix?: string) {
    return this.cloudFilesService.listFiles(id, prefix);
  }

  // Xoá file thật trong bucket — quyền cao hơn list (SETTINGS_STORAGE_KEYS), tách bạch với
  // quyền chỉ sửa giá/link tải (DOWNLOAD_MANAGE_LINKS).
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_STORAGE_KEYS)
  @Delete()
  remove(@Param('id') id: string, @Query('key') key: string) {
    return this.cloudFilesService.deleteFile(id, key);
  }
}
