import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WalletTxStatus, WalletTxType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletGateway } from '../realtime/wallet.gateway';

export type WalletTransactionSortKey =
  'createdAt' | 'amount' | 'balanceAfter' | 'type' | 'status';

export interface WalletTransactionFilterParams {
  type?: WalletTxType;
  status?: WalletTxStatus;
  q?: string;
}

export interface ListWalletTransactionsParams extends WalletTransactionFilterParams {
  skip: number;
  take: number;
  sortBy?: WalletTransactionSortKey;
  sortDir?: 'asc' | 'desc';
}

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletGateway: WalletGateway,
  ) {}

  // Tự tạo ví rỗng nếu user chưa có (vd tài khoản tạo trước khi Wallet là bắt buộc) —
  // tránh phải chạy migration backfill riêng, upsert đơn giản và idempotent.
  async getOrCreate(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
      select: { balance: true, updatedAt: true },
    });
  }

  private buildWhere(
    params: WalletTransactionFilterParams,
  ): Prisma.WalletTransactionWhereInput {
    return {
      ...(params.type && { type: params.type }),
      ...(params.status && { status: params.status }),
      ...(params.q && {
        wallet: {
          user: {
            OR: [
              { email: { contains: params.q, mode: 'insensitive' } },
              { displayName: { contains: params.q, mode: 'insensitive' } },
            ],
          },
        },
      }),
    };
  }

  // Sổ giao dịch $P toàn hệ thống cho Admin/Super Moderator đối soát (wallet.view.any) —
  // ghép sẵn thông tin user để FE không phải gọi thêm request.
  async listAll(params: ListWalletTransactionsParams) {
    const where = this.buildWhere(params);
    const orderBy: Prisma.WalletTransactionOrderByWithRelationInput = {
      [params.sortBy ?? 'createdAt']: params.sortDir ?? 'desc',
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where,
        orderBy,
        skip: params.skip,
        take: params.take,
        include: {
          wallet: {
            select: {
              user: { select: { id: true, email: true, displayName: true } },
            },
          },
        },
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);

    const items = rows.map(({ wallet, ...tx }) => ({
      ...tx,
      user: wallet.user,
    }));
    return { items, total };
  }

  // Xoá hàng loạt theo đúng bộ lọc đang áp dụng trên trang Quản lý giao dịch — chỉ xoá bản ghi
  // WalletTransaction (sổ lịch sử), KHÔNG đụng tới Wallet.balance (số dư là cột riêng, không tính
  // lại từ tổng transaction) nên không làm sai số dư hiện tại của user, chỉ mất lịch sử đối soát.
  async deleteByFilter(params: WalletTransactionFilterParams) {
    const where = this.buildWhere(params);
    if (Object.keys(where).length === 0) {
      throw new BadRequestException(
        'Phải chọn ít nhất 1 điều kiện lọc trước khi xoá hàng loạt',
      );
    }
    const result = await this.prisma.walletTransaction.deleteMany({ where });
    return { count: result.count };
  }

  // Điều chỉnh số dư tay (wallet.adjust) — dùng khi webhook SePay không khớp đối soát (UC23)
  // hoặc các trường hợp cần cộng/trừ $P thủ công khác. Luôn ghi WalletTransaction trong cùng
  // transaction với cập nhật balance để không bao giờ lệch số dư (xem comment schema.prisma).
  async adjustBalance(
    userEmail: string,
    adminUserId: string,
    amount: number,
    note?: string,
  ) {
    const targetUser = await this.prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true },
    });
    if (!targetUser)
      throw new NotFoundException('Không tìm thấy user với email này');

    const walletTransaction = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId: targetUser.id },
        update: {},
        create: { userId: targetUser.id, balance: 0 },
      });
      const balanceAfter = wallet.balance + amount;
      if (balanceAfter < 0) {
        throw new BadRequestException('Số dư sau điều chỉnh không được âm');
      }

      const created = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTxType.ADMIN_ADJUST,
          amount,
          balanceAfter,
          status: WalletTxStatus.SUCCESS,
          referenceType: 'admin_adjust',
          referenceId: adminUserId,
          note,
        },
      });
      await tx.wallet.update({
        where: { userId: targetUser.id },
        data: { balance: balanceAfter },
      });
      return created;
    });

    this.walletGateway.emitWalletUpdated(targetUser.id, {
      balance: walletTransaction.balanceAfter,
    });
    return walletTransaction;
  }
}
