import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { SiteSettingsService } from './site-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { UpdateGeneralSettingsDto } from './dto/update-general-settings.dto';

@Controller('settings')
export class SiteSettingsController {
  constructor(private readonly siteSettingsService: SiteSettingsService) {}

  // Public — layout/trang chủ (Server Component) đọc cấu hình chung để render, không cần đăng nhập.
  @Get('general')
  getGeneral() {
    return this.siteSettingsService.getGeneralSettings();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_GENERAL)
  @Put('general')
  updateGeneral(@Body() dto: UpdateGeneralSettingsDto) {
    return this.siteSettingsService.updateGeneralSettings(dto);
  }
}
