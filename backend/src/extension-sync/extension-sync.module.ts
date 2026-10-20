import { Module } from '@nestjs/common';
import { ExtensionSyncService } from './extension-sync.service';
import { ExtensionSyncController } from './extension-sync.controller';
import { ApiClientGuard } from './guards/api-client.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ExtensionSyncController],
  providers: [ExtensionSyncService, ApiClientGuard],
})
export class ExtensionSyncModule {}
