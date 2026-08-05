import { Injectable, Logger } from '@nestjs/common';
import { Prisma, UserActivityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Ghi log hoạt động user (đăng nhập, xem bài viết, nạp tiền, ghé thăm profile người khác) — luôn
// fire-and-forget từ nơi gọi (không await), không bao giờ throw ra ngoài, đúng convention side-effect
// phụ đã dùng cho mail.service.ts — 1 lần ghi activity lỗi không được làm hỏng luồng chính (đăng
// nhập, xem bài, nạp tiền...).
@Injectable()
export class UserActivityService {
  private readonly logger = new Logger(UserActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(
    userId: string,
    type: UserActivityType,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
  ): Promise<void> {
    try {
      await this.prisma.userActivity.create({
        data: {
          userId,
          type,
          metadata: metadata as Prisma.InputJsonValue,
          ipAddress,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Ghi UserActivity "${type}" thất bại: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
