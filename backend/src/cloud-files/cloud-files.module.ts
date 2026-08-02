import { Module } from '@nestjs/common';
import { CloudFilesService } from './cloud-files.service';
import { CloudFilesController } from './cloud-files.controller';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [CloudFilesController],
  providers: [CloudFilesService],
})
export class CloudFilesModule {}
