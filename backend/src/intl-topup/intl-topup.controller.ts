import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { IntlTopupStatus } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesService } from '../roles/roles.service';
import { IntlTopupService } from './intl-topup.service';
import { CreateIntlTopupOrderDto } from './dto/create-intl-topup-order.dto';
import { ClaimIntlTopupPaidDto } from './dto/claim-intl-topup-paid.dto';
import { ApproveIntlTopupDto } from './dto/approve-intl-topup.dto';
import { RejectIntlTopupDto } from './dto/reject-intl-topup.dto';
import { UpdateIntlPaymentSettingsDto } from './dto/update-intl-payment-settings.dto';
import { SkipAudit } from '../audit-log/audit.decorators';

interface AuthUser {
  id: string;
  email: string;
}

// API riêng của luồng nạp quốc tế (Buy Me a Coffee) — không đi qua /wallet/topup hay /sepay/* của
// luồng nội địa. User cần đăng nhập + quyền ví (wallet.view.own, giống nạp SePay); Admin cần
// payment.intl.manage.
@Controller('intl-topup')
export class IntlTopupController {
  constructor(
    private readonly intlTopupService: IntlTopupService,
    private readonly rolesService: RolesService,
  ) {}

  // ───────── User ─────────

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.WALLET_VIEW_OWN)
  @Get('config')
  getConfig() {
    return this.intlTopupService.getPublicConfig();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.WALLET_VIEW_OWN)
  @Post('orders')
  createOrder(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateIntlTopupOrderDto,
    @Req() req: Request,
  ) {
    return this.intlTopupService.createOrder(
      user.id,
      dto.packageId,
      req.ip ?? null,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.WALLET_VIEW_OWN)
  @Get('orders/me')
  listOwn(@CurrentUser() user: AuthUser) {
    return this.intlTopupService.listOwn(user.id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.WALLET_VIEW_OWN)
  @Post('orders/:id/claim-paid')
  claimPaid(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ClaimIntlTopupPaidDto,
  ) {
    return this.intlTopupService.claimPaid(user.id, id, dto.payerEmail);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.WALLET_VIEW_OWN)
  @Post('orders/:id/cancel')
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.intlTopupService.cancel(user.id, id);
    return { success: true };
  }

  // Chủ đơn hoặc Admin (payment.intl.manage) — chỉ JwtAuthGuard, quyền kiểm tra trong service.
  @UseGuards(JwtAuthGuard)
  @Get('orders/:id/invoice')
  async getInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const permissions = await this.rolesService.getUserPermissionKeys(user.id);
    const { pdf, filename } = await this.intlTopupService.getInvoice(
      id,
      user.id,
      permissions.includes(PERMISSIONS.PAYMENT_INTL_MANAGE),
    );
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  // ───────── Admin ─────────

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.PAYMENT_INTL_MANAGE)
  @Get('admin/orders')
  listForAdmin(
    @Query('status') status?: IntlTopupStatus,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.intlTopupService.listForAdmin({
      status: status && status in IntlTopupStatus ? status : undefined,
      q: q?.trim() || undefined,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @SkipAudit() // ghi INTL_TOPUP_APPROVED trong cùng transaction
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.PAYMENT_INTL_MANAGE)
  @Post('admin/orders/:id/approve')
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ApproveIntlTopupDto,
  ) {
    return this.intlTopupService.approve(id, user.id, dto);
  }

  @SkipAudit() // ghi INTL_TOPUP_REJECTED chi tiết trong service
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.PAYMENT_INTL_MANAGE)
  @Post('admin/orders/:id/reject')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RejectIntlTopupDto,
  ) {
    return this.intlTopupService.reject(id, user.id, dto.reason);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.PAYMENT_INTL_MANAGE)
  @Get('admin/settings')
  getAdminSettings() {
    return this.intlTopupService.getAdminSettings();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.PAYMENT_INTL_MANAGE)
  @Put('admin/settings')
  updateSettings(@Body() dto: UpdateIntlPaymentSettingsDto) {
    return this.intlTopupService.updateSettings(dto);
  }
}
