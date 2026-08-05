import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { RecaptchaService } from './recaptcha.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { UpdateRecaptchaConfigDto } from './dto/update-recaptcha-config.dto';

@Controller('recaptcha')
export class RecaptchaController {
  constructor(private readonly recaptchaService: RecaptchaService) {}

  // Công khai — form đăng ký/đăng nhập cần biết enabled + siteKey để quyết định có render widget
  // hay không (siteKey vốn public theo thiết kế Google, an toàn expose).
  @Get('config')
  getPublicConfig() {
    return this.recaptchaService.getPublicConfig();
  }

  // Dùng chung quyền settings.general với trang Cài đặt chung — không thêm permission key mới.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_GENERAL)
  @Get('admin-config')
  getAdminConfig() {
    return this.recaptchaService.getAdminConfig();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_GENERAL)
  @Put('admin-config')
  updateConfig(@Body() dto: UpdateRecaptchaConfigDto) {
    return this.recaptchaService.updateConfig(dto);
  }
}
