import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Ghi log thao tác nhạy cảm (đổi quyền, chỉnh ví tay, đổi key R2/S3) — cùng convention
// fire-and-forget của UserActivityService: không bao giờ throw ra ngoài luồng chính, 1 lần ghi
// audit log lỗi không được chặn thao tác thật (assignRole/adjustBalance/...).
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(
    actorUserId: string,
    action: AuditAction,
    options?: {
      targetType?: string;
      targetId?: string;
      metadata?: Record<string, unknown>;
      ipAddress?: string;
    },
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId,
          action,
          targetType: options?.targetType,
          targetId: options?.targetId,
          metadata: options?.metadata as Prisma.InputJsonValue,
          ipAddress: options?.ipAddress,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Ghi AuditLog "${action}" thất bại: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async list(params: {
    skip: number;
    take: number;
    action?: AuditAction;
    actorUserId?: string;
  }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(params.action && { action: params.action }),
      ...(params.actorUserId && { actorUserId: params.actorUserId }),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: {
          actor: { select: { id: true, displayName: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}
