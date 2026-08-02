import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { SepayService } from './sepay.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { UpdateSepayConfigDto } from './dto/update-sepay-config.dto';

@Controller('sepay/config')
export class SepayConfigController {
  constructor(private readonly sepayService: SepayService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_PAYMENT)
  @Get()
  getConfig() {
    return this.sepayService.getPublicConfig();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_PAYMENT)
  @Put()
  updateConfig(@Body() dto: UpdateSepayConfigDto) {
    return this.sepayService.updateConfig(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_PAYMENT)
  @Post('test-connection')
  testConnection() {
    return this.sepayService.testApiConnection();
  }
}
