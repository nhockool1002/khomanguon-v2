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
import { PresignUploadPartDto } from './dto/presign-upload-part.dto';
import { CompleteMultipartUploadDto } from './dto/complete-multipart-upload.dto';
import { AbortMultipartUploadDto } from './dto/abort-multipart-upload.dto';
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

  // File > 5GB không thể PUT 1 lần (trần cứng của S3 PutObject) — 4 route dưới đây theo đúng quy
  // trình multipart chuẩn, FE gọi tuần tự init -> part (lặp lại từng phần) -> complete (hoặc abort
  // nếu huỷ/lỗi giữa chừng). Cùng quyền DOWNLOAD_MANAGE_LINKS như presign-upload đơn — bản chất vẫn
  // chỉ là ký URL/gọi API quản lý multipart, chưa từng đụng vào nội dung file.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)
  @Post('presign-upload/multipart/init')
  initMultipartUpload(@Param('id') id: string, @Body() dto: PresignUploadDto) {
    return this.cloudFilesService.initMultipartUpload(
      id,
      dto.filename,
      dto.folder,
      dto.contentType,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)
  @Post('presign-upload/multipart/part')
  presignUploadPart(
    @Param('id') id: string,
    @Body() dto: PresignUploadPartDto,
  ) {
    return this.cloudFilesService.presignUploadPart(
      id,
      dto.key,
      dto.uploadId,
      dto.partNumber,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)
  @Post('presign-upload/multipart/complete')
  completeMultipartUpload(
    @Param('id') id: string,
    @Body() dto: CompleteMultipartUploadDto,
  ) {
    return this.cloudFilesService.completeMultipartUpload(
      id,
      dto.key,
      dto.uploadId,
      dto.parts,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)
  @Post('presign-upload/multipart/abort')
  abortMultipartUpload(
    @Param('id') id: string,
    @Body() dto: AbortMultipartUploadDto,
  ) {
    return this.cloudFilesService.abortMultipartUpload(
      id,
      dto.key,
      dto.uploadId,
    );
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
