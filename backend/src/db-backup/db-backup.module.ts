import { Module } from '@nestjs/common';
import { DbBackupService } from './db-backup.service';
import { DbBackupCronService } from './db-backup-cron.service';
import { DbBackupController } from './db-backup.controller';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [DbBackupController],
  providers: [DbBackupService, DbBackupCronService],
})
export class DbBackupModule {}
