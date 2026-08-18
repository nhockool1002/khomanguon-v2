import { Module } from '@nestjs/common';
import { ContentImportService } from './content-import.service';
import { ContentImportController } from './content-import.controller';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [ContentImportController],
  providers: [ContentImportService],
})
export class ContentImportModule {}
