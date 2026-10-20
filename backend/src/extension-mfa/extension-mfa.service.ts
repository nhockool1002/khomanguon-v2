import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExtensionMfaService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(userId: string) {
    const row = await this.prisma.extensionMfaData.findUnique({
      where: { userId },
    });
    // null nghĩa là user chưa từng đồng bộ mã MFA — client tự hiểu là "chưa có gì trên server".
    return row ? { data: row.data, updatedAt: row.updatedAt } : null;
  }

  async saveMine(userId: string, data: Record<string, unknown>) {
    // `data` LUÔN là ciphertext AES-GCM ({iv, data} base64) do K-Extension mã hoá phía client —
    // backend không giải mã, không validate cấu trúc bên trong, chỉ lưu/trả lại nguyên khối (xem
    // comment model ExtensionMfaData trong schema.prisma).
    const json = data as Prisma.InputJsonValue;
    const row = await this.prisma.extensionMfaData.upsert({
      where: { userId },
      create: { userId, data: json },
      update: { data: json },
    });
    return { data: row.data, updatedAt: row.updatedAt };
  }
}
