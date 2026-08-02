import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

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
}
