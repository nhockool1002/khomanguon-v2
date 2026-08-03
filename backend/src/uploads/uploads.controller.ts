import { randomUUID } from 'crypto';
import { extname, relative, sep } from 'path';
import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import {
  datedUploadDestination,
  UPLOAD_ROOT,
} from '../common/dated-upload.util';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Lưu lên đĩa cục bộ (volume /app/uploads), thư mục theo ngày kiểu WordPress
// uploads/posts/yyyy/mm/dd (xem common/dated-upload.util.ts) — Thư viện Media quét thẳng cây thư
// mục này nên MỌI ảnh qua endpoint chung này (nội dung bài viết, avatar, banner...) đều hiện ra ở
// đó. FE luôn ghép URL tuyệt đối (NEXT_PUBLIC_API_URL + path) ngay khi upload xong nên không cần
// biết public origin của backend ở đây (tránh phải đoán protocol/host phía sau reverse proxy).
@Controller('uploads')
export class UploadsController {
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
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Thiếu file');
    const relPath = relative(UPLOAD_ROOT, file.path).split(sep).join('/');
    return { url: `/uploads/${relPath}` };
  }
}
