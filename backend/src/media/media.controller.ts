import { randomUUID } from 'crypto';
import { extname } from 'path';
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { datedUploadDestination } from '../common/dated-upload.util';
import { processUploadedImage } from '../common/image-pipeline.util';

interface AuthUser {
  id: string;
  email: string;
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  // POST_CREATE (không phải MEDIA_MANAGE) — endpoint này còn được gọi từ MediaPickerModal trong
  // trình soạn bài viết (chèn ảnh nội dung/chọn Ảnh đại diện/Ảnh OG), ai viết được bài (post.create)
  // cũng cần duyệt/tải lên thư viện, đúng bar quyền /uploads đã dùng cho upload ảnh nội dung. Trang
  // quản trị "Thư viện Media" (toàn quyền, gồm cả xoá) vẫn chỉ Admin/role có media.manage vào được
  // (chặn ở frontend admin-nav.ts + media-library/page.tsx) — DELETE bên dưới vẫn giữ MEDIA_MANAGE.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.POST_CREATE)
  @Get()
  list(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.mediaService.list({
      q,
      page: Number(page) || 1,
      limit: Number(limit) || 24,
    });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.POST_CREATE)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: datedUploadDestination,
        filename: (_req, file, callback) => {
          callback(
            null,
            `${randomUUID()}${extname(file.originalname).toLowerCase()}`,
          );
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          callback(
            new BadRequestException('Chỉ chấp nhận ảnh JPEG/PNG/WebP/GIF'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Thiếu file');
    await processUploadedImage(file);
    await this.mediaService.record(file, user.id);
    return { ok: true };
  }

  // path (không phải id DB) — Thư viện Media liệt kê trực tiếp từ đĩa nên định danh 1 file là
  // đường dẫn tương đối của nó, giống cách cloud-files dùng ?key= (xem cloud-files.controller.ts).
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.MEDIA_MANAGE)
  @Delete()
  remove(@Query('path') path: string) {
    if (!path) throw new BadRequestException('Thiếu path');
    return this.mediaService.remove(path);
  }
}
