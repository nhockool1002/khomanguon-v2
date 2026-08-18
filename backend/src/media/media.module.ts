import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [MediaController],
  providers: [MediaService],
  // Export để content-import.module.ts tái dùng uploadBuffer() (ảnh trích từ docx/html/pdf) thay vì
  // tự viết lại logic ghi đĩa/cloud + bảng MediaFile lần nữa.
  exports: [MediaService],
})
export class MediaModule {}
