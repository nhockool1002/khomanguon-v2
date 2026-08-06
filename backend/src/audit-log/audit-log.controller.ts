import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuditLogService } from './audit-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';

const AUDIT_ACTIONS = Object.values(AuditAction) as string[];

@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  // @Permissions phải khai báo ở method-level (không phải class-level) — PermissionsGuard chỉ đọc
  // metadata ở context.getHandler(), xem ghi chú đầu roles.controller.ts.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.AUDIT_VIEW)
  @Get()
  list(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('action') action?: string,
    @Query('actorUserId') actorUserId?: string,
  ) {
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    return this.auditLog.list({
      skip,
      take,
      action:
        action && AUDIT_ACTIONS.includes(action)
          ? (action as AuditAction)
          : undefined,
      actorUserId: actorUserId?.trim() || undefined,
    });
  }
}
