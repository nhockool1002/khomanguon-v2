import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExtensionSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(userId: string) {
    const row = await this.prisma.extensionBookmarkData.findUnique({
      where: { userId },
    });
    // null nghĩa là user chưa từng đồng bộ — client tự hiểu là "chưa có gì trên server" và
    // upload cây local hiện tại lên, không coi đây là lỗi.
    return row ? { data: row.data, updatedAt: row.updatedAt } : null;
  }

  async saveMine(userId: string, data: Record<string, unknown>) {
    // `data` là cây JSON tuỳ ý do K-Extension sở hữu (xem comment model ExtensionBookmarkData) —
    // ép kiểu sang InputJsonValue vì Prisma không tự suy ra Record<string, unknown> khớp JSON.
    const json = data as Prisma.InputJsonValue;
    const row = await this.prisma.extensionBookmarkData.upsert({
      where: { userId },
      create: { userId, data: json },
      update: { data: json },
    });
    return { data: row.data, updatedAt: row.updatedAt };
  }
}
