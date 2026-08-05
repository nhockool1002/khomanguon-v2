import { Module } from '@nestjs/common';
import { CloudFilesService } from './cloud-files.service';
import { CloudFilesController } from './cloud-files.controller';
import { CloudUploadHistoryService } from './cloud-upload-history.service';
import { CloudUploadHistoryController } from './cloud-upload-history.controller';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [CloudFilesController, CloudUploadHistoryController],
  providers: [CloudFilesService, CloudUploadHistoryService],
})
export class CloudFilesModule {}
