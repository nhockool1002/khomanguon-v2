import {
  BadRequestException,
  Body,
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
import { memoryStorage } from 'multer';
import { MediaService } from './media.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

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
  constructor(
    private readonly mediaService: MediaService,
    private readonly prisma: PrismaService,
  ) {}

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
    @Query('storageProviderId') storageProviderId?: string,
  ) {
    return this.mediaService.list({
      q,
      page: Number(page) || 1,
      limit: Number(limit) || 24,
      storageProviderId: storageProviderId || undefined,
    });
  }

  // Danh sách nguồn khả dụng cho tab Local/R2/S3 (media-picker-modal.tsx, admin/media-library) —
  // cùng bar quyền post.create với list()/upload() ở trên vì mọi tác giả bài viết cần biết tab nào
  // dùng được. Chỉ trả Provider đang isDefault + đã cấu hình publicBaseUrl (Provider thiếu domain
  // public thì không dùng được cho Media — ảnh sẽ không có URL vĩnh viễn để hiển thị), và chỉ 3
  // field cần cho UI tab, không lộ endpoint/accessKeyId như GET /storage-providers (quyền cao hơn).
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.POST_CREATE)
  @Get('storage-targets')
  async storageTargets() {
    const providers = await this.prisma.storageProvider.findMany({
      where: {
        isDefault: true,
        publicBaseUrl: { not: null },
        type: { in: ['R2', 'S3'] },
      },
      select: { id: true, type: true, label: true },
    });
    return providers;
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.POST_CREATE)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
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
    @Body('storageProviderId') storageProviderId: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Thiếu file');

    await this.mediaService.uploadBuffer({
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalName: file.originalname,
      uploadedById: user.id,
      storageProviderId: storageProviderId || undefined,
    });
    return { ok: true };
  }

  // path (không phải id DB) — Thư viện Media liệt kê trực tiếp từ nơi lưu trữ thật (đĩa hoặc bucket)
  // nên định danh 1 file là key/đường dẫn tương đối của nó, giống cách cloud-files dùng ?key= (xem
  // cloud-files.controller.ts).
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.MEDIA_MANAGE)
  @Delete()
  remove(
    @Query('path') path: string,
    @Query('storageProviderId') storageProviderId?: string,
  ) {
    if (!path) throw new BadRequestException('Thiếu path');
    return this.mediaService.remove(path, storageProviderId || undefined);
  }
}
