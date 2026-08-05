import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DbBackupService } from './db-backup.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { UpdateBackupConfigDto } from './dto/update-backup-config.dto';

// @Permissions(...) PHẢI khai báo lại ở TỪNG handler (không đặt ở class) — PermissionsGuard chỉ đọc
// metadata qua context.getHandler(), đặt ở class sẽ bị bỏ qua và guard cho qua mọi user đã đăng
// nhập (lỗi thật đã gặp và sửa ở roles.controller.ts/storage-providers.controller.ts, xem comment
// đầu 2 file đó). Mọi route ở đây cần settings.backup — backup chứa toàn bộ dữ liệu hệ thống, mức
// nhạy cảm cao nhất.
@Controller('db-backup')
export class DbBackupController {
  constructor(private readonly dbBackupService: DbBackupService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_BACKUP)
  @Get('config')
  getConfig() {
    return this.dbBackupService.getConfig();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_BACKUP)
  @Put('config')
  updateConfig(@Body() dto: UpdateBackupConfigDto) {
    return this.dbBackupService.updateConfig(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_BACKUP)
  @Get('records')
  listRecords(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.dbBackupService.listRecords(
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_BACKUP)
  @Get('records/:id/download-url')
  getDownloadUrl(@Param('id') id: string) {
    return this.dbBackupService.getDownloadUrl(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_BACKUP)
  @Post('run-now')
  runNow() {
    return this.dbBackupService.runBackup();
  }
}
