import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { SepayService } from '../sepay/sepay.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateTopupOrderDto } from '../sepay/dto/create-topup-order.dto';

interface AuthUser {
  id: string;
  email: string;
}

// PermissionsGuard chỉ đọc metadata gắn trực tiếp trên từng handler (context.getHandler()), không
// gộp theo class — @Permissions phải khai báo lại ở mỗi method (xem storage-providers.controller.ts).
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly sepayService: SepayService,
  ) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.WALLET_VIEW_OWN)
  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.walletService.getOrCreate(user.id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.WALLET_VIEW_OWN)
  @Get('transactions')
  listTransactions(
    @CurrentUser() user: AuthUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.sepayService.listTransactions(user.id, Number(page) || 1, Number(limit) || 20);
  }

  // Tỉ giá + gói nạp nhanh cho trang /tai-khoan/vi — không lộ STK/API key (xem sepay-config.controller.ts).
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.WALLET_VIEW_OWN)
  @Get('topup-presets')
  getTopupPresets() {
    return this.sepayService.getTopupPresets();
  }

  // Tạo yêu cầu nạp tiền — trả kèm qrUrl VietQR để FE render ngay, không cần gọi thêm request nào.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.WALLET_VIEW_OWN)
  @Post('topup')
  createTopup(@CurrentUser() user: AuthUser, @Body() dto: CreateTopupOrderDto) {
    return this.sepayService.createTopupOrder(user.id, dto.amountVnd);
  }

  // Poll trạng thái — dùng khi F5 lại trang hoặc mất kết nối WebSocket, không phải luồng chính.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.WALLET_VIEW_OWN)
  @Get('topup/:id')
  getTopup(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sepayService.getTopupOrder(user.id, id);
  }
}
