import { Injectable, Logger } from '@nestjs/common';
import { CommentStatus, PostStatus, UserActivityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationGateway } from '../realtime/notification.gateway';

const ACCOUNT_AGE_VETERAN_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Tự động cấp huy hiệu thành tích — gọi fire-and-forget (không await) từ các luồng đã có sẵn
// UserActivityService.log() cạnh bên (đăng bài, bình luận, đăng nhập, nạp tiền...), cùng convention
// "side-effect phụ không được làm hỏng luồng chính" (xem UserActivityService). checkAndAward()
// không nhận tham số phân loại sự kiện — mỗi lần gọi đều re-check TOÀN BỘ danh mục huy hiệu, đơn
// giản hơn quản lý routing theo loại trigger, chi phí chỉ vài COUNT query nhỏ (quy mô hiện tại của
// site không đáng lo hiệu năng).
@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  async checkAndAward(userId: string): Promise<void> {
    try {
      const [user, publishedPostCount, commentCount, depositCount, earned] =
        await Promise.all([
          this.prisma.user.findUnique({
            where: { id: userId },
            select: { createdAt: true },
          }),
          this.prisma.post.count({
            where: { authorId: userId, status: PostStatus.PUBLISHED },
          }),
          // HIDDEN (bị Moderator ẩn) không tính vào thành tích — chỉ PUBLISHED.
          this.prisma.comment.count({
            where: { userId, status: CommentStatus.PUBLISHED },
          }),
          this.prisma.userActivity.count({
            where: { userId, type: UserActivityType.DEPOSIT },
          }),
          this.prisma.userBadge.findMany({
            where: { userId },
            select: { badge: { select: { slug: true } } },
          }),
        ]);
      if (!user) return;

      const earnedSlugs = new Set(earned.map((b) => b.badge.slug));
      const accountAgeDays =
        (Date.now() - user.createdAt.getTime()) / MS_PER_DAY;

      const qualifiedSlugs = [
        publishedPostCount >= 1 && 'first-post',
        publishedPostCount >= 10 && 'prolific-writer',
        commentCount >= 1 && 'first-comment',
        commentCount >= 100 && 'century-commenter',
        accountAgeDays >= ACCOUNT_AGE_VETERAN_DAYS && 'veteran',
        depositCount >= 1 && 'supporter',
      ].filter((slug): slug is string => Boolean(slug));

      const newSlugs = qualifiedSlugs.filter((slug) => !earnedSlugs.has(slug));
      if (newSlugs.length === 0) return;

      const badges = await this.prisma.badge.findMany({
        where: { slug: { in: newSlugs } },
      });

      for (const badge of badges) {
        // Bắt lỗi unique-constraint riêng từng badge (race 2 trigger cùng lúc, vd đăng bài + bình
        // luận gần như đồng thời) — không để 1 badge bị trùng làm hỏng việc cấp các badge còn lại.
        const created = await this.prisma.userBadge
          .create({ data: { userId, badgeId: badge.id } })
          .catch(() => null);
        if (!created) continue;

        const notif = await this.notifications.createBadgeEarned(
          userId,
          badge.id,
        );
        if (notif) this.notificationGateway.emitNotification(userId, notif);
      }
    } catch (err) {
      this.logger.warn(
        `checkAndAward thất bại cho user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async listForUser(userId: string) {
    return this.prisma.userBadge.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        badge: {
          select: { slug: true, name: true, description: true, icon: true },
        },
      },
    });
  }
}
