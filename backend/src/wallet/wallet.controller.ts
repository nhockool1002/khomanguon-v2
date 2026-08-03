import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WalletTxStatus, WalletTxType } from '@prisma/client';
import { WalletService, WalletTransactionSortKey } from './wallet.service';
import { SepayService } from '../sepay/sepay.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateTopupOrderDto } from '../sepay/dto/create-topup-order.dto';
import { AdjustWalletDto } from './dto/adjust-wallet.dto';

const WALLET_TX_TYPES = Object.values(WalletTxType) as string[];
const WALLET_TX_STATUSES = Object.values(WalletTxStatus) as string[];
const WALLET_TX_SORT_KEYS: WalletTransactionSortKey[] = [
  'createdAt',
  'amount',
  'balanceAfter',
  'type',
  'status',
];

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
    return this.sepayService.listTransactions(
      user.id,
      Number(page) || 1,
      Number(limit) || 20,
    );
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

  // Sổ giao dịch $P toàn hệ thống — trang "Quản lý giao dịch" của Admin/Super Moderator (UC22-adjacent).
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.WALLET_VIEW_ANY)
  @Get('admin/transactions')
  listAllTransactions(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    return this.walletService.listAll({
      skip,
      take,
      type:
        type && WALLET_TX_TYPES.includes(type)
          ? (type as WalletTxType)
          : undefined,
      status:
        status && WALLET_TX_STATUSES.includes(status)
          ? (status as WalletTxStatus)
          : undefined,
      q: q?.trim() || undefined,
      sortBy:
        sortBy &&
        WALLET_TX_SORT_KEYS.includes(sortBy as WalletTransactionSortKey)
          ? (sortBy as WalletTransactionSortKey)
          : undefined,
      sortDir: sortDir === 'asc' ? 'asc' : undefined,
    });
  }

  // Xoá hàng loạt đúng theo bộ lọc đang áp dụng trên trang Quản lý giao dịch — quyền cao hơn view
  // (WALLET_ADJUST, cùng mức với điều chỉnh tay) vì đây là thao tác phá huỷ dữ liệu tài chính.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.WALLET_ADJUST)
  @Delete('admin/transactions')
  deleteTransactionsByFilter(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.walletService.deleteByFilter({
      type:
        type && WALLET_TX_TYPES.includes(type)
          ? (type as WalletTxType)
          : undefined,
      status:
        status && WALLET_TX_STATUSES.includes(status)
          ? (status as WalletTxStatus)
          : undefined,
      q: q?.trim() || undefined,
    });
  }

  // Điều chỉnh số dư tay theo email — dùng khi đối soát webhook SePay lệch (xem comment
  // sepay.service.ts matchAndCredit) hoặc các trường hợp cộng/trừ $P thủ công khác.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.WALLET_ADJUST)
  @Post('admin/adjust')
  adjustBalance(@CurrentUser() admin: AuthUser, @Body() dto: AdjustWalletDto) {
    return this.walletService.adjustBalance(
      dto.userEmail,
      admin.id,
      dto.amount,
      dto.note,
    );
  }
}
