import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ExtensionMfaService } from './extension-mfa.service';
import { SyncMfaDto } from './dto/sync-mfa.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { PERMISSIONS } from '../roles/permissions.constant';
import { ApiClientGuard } from '../common/guards/api-client.guard';

interface AuthUser {
  id: string;
  email: string;
}

// API cho K-Extension đồng bộ mã MFA/TOTP (2FA) — `data` luôn là ciphertext, xem comment DTO.
// PermissionsGuard đọc metadata @Permissions() qua context.getHandler() — chỉ nhận ở cấp method,
// đặt ở cấp class sẽ bị bỏ qua lặng lẽ (xem bug đã gặp ở ExtensionSyncController), nên lặp lại
// @UseGuards/@Permissions trên từng handler.
@Controller('extension-mfa/data')
export class ExtensionMfaController {
  constructor(private readonly service: ExtensionMfaService) {}

  @UseGuards(ApiClientGuard, JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.EXT_MFA_SYNC)
  @Get()
  getMine(@CurrentUser() user: AuthUser) {
    return this.service.getMine(user.id);
  }

  @UseGuards(ApiClientGuard, JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.EXT_MFA_SYNC)
  @Put()
  saveMine(@CurrentUser() user: AuthUser, @Body() dto: SyncMfaDto) {
    return this.service.saveMine(user.id, dto.data);
  }
}
