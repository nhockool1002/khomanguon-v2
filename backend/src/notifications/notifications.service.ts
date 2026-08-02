import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const notificationSelect = {
  id: true,
  userId: true,
  type: true,
  isRead: true,
  createdAt: true,
  actor: { select: { id: true, displayName: true, avatarUrl: true } },
  comment: { select: { id: true, content: true } },
  post: { select: { id: true, title: true, slug: true } },
} satisfies Prisma.NotificationSelect;

const PREVIEW_LENGTH = 140;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Gọi từ CommentsService.create() khi content có @mention hợp lệ — best-effort, không rollback
  // việc tạo comment nếu bước này lỗi (xem comment ở nơi gọi).
  async createMentions(
    actorId: string,
    commentId: string,
    postId: string,
    mentionedUserIds: string[],
  ) {
    const targets = [...new Set(mentionedUserIds)].filter(
      (id) => id !== actorId,
    );
    if (targets.length === 0) return [];

    const existingUsers = await this.prisma.user.findMany({
      where: { id: { in: targets } },
      select: { id: true },
    });
    const validTargets = existingUsers.map((u) => u.id);
    if (validTargets.length === 0) return [];

    await this.prisma.notification.createMany({
      data: validTargets.map((userId) => ({
        userId,
        type: NotificationType.MENTION,
        actorId,
        commentId,
        postId,
      })),
    });

    return this.prisma.notification.findMany({
      where: { userId: { in: validTargets }, commentId, actorId },
      select: notificationSelect,
    });
  }

  async list(userId: string, page: number, limit: number) {
    const take = Math.min(Math.max(limit, 1), 50);
    const skip = (Math.max(page, 1) - 1) * take;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: notificationSelect,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return { items: rows.map((n) => this.truncate(n)), total };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(userId: string, id: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== userId) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  private truncate<
    T extends { comment: { id: string; content: string } | null },
  >(notif: T) {
    if (!notif.comment) return notif;
    const content =
      notif.comment.content.length > PREVIEW_LENGTH
        ? `${notif.comment.content.slice(0, PREVIEW_LENGTH)}…`
        : notif.comment.content;
    return { ...notif, comment: { ...notif.comment, content } };
  }
}
