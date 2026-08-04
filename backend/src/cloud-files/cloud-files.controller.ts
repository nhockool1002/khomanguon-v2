import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CloudFilesService } from './cloud-files.service';
import { PresignUploadDto } from './dto/presign-upload.dto';
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

  // Cùng quyền với list (không phải quyền xoá) — chỉ ký URL, chưa ghi gì vào bucket, đúng bar
  // quyền của cả trang "Quản lý File Cloud" (list + upload) mà user đã có sẵn để dùng trang này.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)
  @Post('presign-upload')
  presignUpload(@Param('id') id: string, @Body() dto: PresignUploadDto) {
    return this.cloudFilesService.presignUpload(id, dto.filename, dto.folder);
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
