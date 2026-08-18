import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ContentImportService } from './content-import.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface AuthUser {
  id: string;
  email: string;
}

// Tài liệu (docx/pdf) nặng hơn nhiều so với 1 ảnh đơn — giới hạn 20MB (so với 5MB của /media),
// vẫn đủ chặn file bất thường mà không quá chật với file Word/PDF nhiều trang thực tế.
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const upload = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

// Cùng bar quyền post.create với /media và /uploads — nhập tài liệu vào bài viết là một dạng soạn
// nội dung, không phải quản trị (không cần quyền media.manage). @UseGuards/@Permissions khai báo
// lại ở TỪNG handler (không đặt 1 lần ở class) — PermissionsGuard chỉ đọc metadata gắn trực tiếp
// trên handler, xem cùng gotcha đã ghi ở widgets.controller.ts/sliders.controller.ts.
@Controller('content-import')
export class ContentImportController {
  constructor(private readonly contentImportService: ContentImportService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.POST_CREATE)
  @Post('docx')
  @UseInterceptors(upload)
  async fromDocx(
    @UploadedFile() file: Express.Multer.File,
    @Body('storageProviderId') storageProviderId: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Thiếu file');
    const html = await this.contentImportService.fromDocx(file.buffer, {
      uploadedById: user.id,
      storageProviderId: storageProviderId || undefined,
    });
    return { html };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.POST_CREATE)
  @Post('html')
  @UseInterceptors(upload)
  async fromHtml(
    @UploadedFile() file: Express.Multer.File,
    @Body('storageProviderId') storageProviderId: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Thiếu file');
    const html = await this.contentImportService.fromHtml(
      file.buffer.toString('utf-8'),
      {
        uploadedById: user.id,
        storageProviderId: storageProviderId || undefined,
      },
    );
    return { html };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.POST_CREATE)
  @Post('pdf')
  @UseInterceptors(upload)
  async fromPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body('storageProviderId') storageProviderId: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Thiếu file');
    const html = await this.contentImportService.fromPdf(file.buffer, {
      uploadedById: user.id,
      storageProviderId: storageProviderId || undefined,
    });
    return { html };
  }
}
