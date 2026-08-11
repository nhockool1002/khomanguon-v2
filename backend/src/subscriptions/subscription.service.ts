import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  Prisma,
  SubscriptionMembershipStatus,
  SubscriptionOrderStatus,
  UserActivityType,
  WalletTxStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SepayService } from '../sepay/sepay.service';
import { SubscriptionPlansService } from '../subscription-plans/subscription-plans.service';
import { UserActivityService } from '../user-activity/user-activity.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { DEFAULT_ROLES } from '../roles/permissions.constant';
import type { SepayWebhookPayload } from '../sepay/sepay-webhook.types';

const ORDER_TTL_MINUTES = 30;

function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sepayService: SepayService,
    private readonly subscriptionPlansService: SubscriptionPlansService,
    private readonly userActivity: UserActivityService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ───────────────────────── Tạo yêu cầu mua gói ─────────────────────────

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      // Tiền tố "SUB" — KHÁC hẳn "GD" của TopupOrder.code (sepay.service.ts) nên 2 loại đơn không
      // bao giờ trùng mã, webhook thử khớp lần lượt 2 bảng độc lập không sợ nhầm lẫn.
      const code = `SUB${randomInt(100000, 999999)}`;
      const existing = await this.prisma.subscriptionOrder.findUnique({
        where: { code },
      });
      if (!existing) return code;
    }
    throw new Error('Không sinh được mã đơn Subscription duy nhất — thử lại');
  }

  async createOrder(userId: string, planId: string) {
    // Chặn mua chồng — user đang có 1 kỳ ACTIVE thì không được tạo đơn mới cho tới khi hết hạn hoặc
    // bị Admin revoke. Trước đây webhook cho phép "mua gói mới thay thế kỳ đang dùng", nhưng theo yêu
    // cầu thực tế UI phải disable nút Đăng ký khi đã có gói — validate lại ở tầng service (không chỉ
    // FE) để chặn cả trường hợp gọi thẳng API.
    const existingActive = await this.findActiveMembership(userId);
    if (existingActive) {
      throw new BadRequestException(
        'Bạn đang có gói Subscription đang hoạt động — không thể đăng ký thêm cho tới khi hết hạn hoặc được Admin thu hồi',
      );
    }

    const plan =
      await this.subscriptionPlansService.findActiveByIdOrThrow(planId);
    const config = await this.sepayService.getConfig();
    if (!config.bankAccountNumber || !config.bankName) {
      throw new BadRequestException(
        'SePay chưa được cấu hình — liên hệ Admin cài đặt STK ngân hàng trước',
      );
    }

    const code = await this.generateUniqueCode();
    const expiresAt = new Date(Date.now() + ORDER_TTL_MINUTES * 60_000);
    const order = await this.prisma.subscriptionOrder.create({
      data: { userId, planId, code, amountVnd: plan.priceVnd, expiresAt },
    });

    return {
      order: { ...order, plan },
      qrUrl: this.sepayService.buildVietQrUrl(config, plan.priceVnd, code),
    };
  }

  async getOrder(userId: string, id: string) {
    const order = await this.prisma.subscriptionOrder.findUnique({
      where: { id },
      include: { plan: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn đăng ký');
    if (order.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xem đơn này');
    }
    return order;
  }

  // ───────────────────────── Webhook ─────────────────────────

  // Bảng đối soát RIÊNG (subscription_sepay_transactions) — KHÔNG dùng chung SepayTransaction, cố ý
  // để không đụng 1 dòng nào vào bảng/luồng nạp $P đang chạy thật (chỉ gọi hàm này sau khi
  // sepayService.matchAndCredit() ở luồng nạp tiền đã chạy XONG và không khớp — xem
  // sepay-webhook.controller.ts). Cùng cơ chế chống double-activate như matchAndCredit: check tồn
  // tại trước (fast path cho SePay retry tuần tự), rồi tạo record đối soát BÊN TRONG transaction
  // kích hoạt — 2 webhook trùng chạy gần như đồng thời sẽ có 1 cái vi phạm unique constraint lúc
  // insert, rollback an toàn, không kích hoạt 2 lần.
  async matchAndActivateFromWebhook(
    payload: SepayWebhookPayload,
  ): Promise<{ activated: boolean }> {
    const sepayTransactionCode = String(payload.id);
    const existing = await this.prisma.subscriptionSepayTransaction.findUnique({
      where: { sepayTransactionCode },
    });
    if (existing)
      return { activated: existing.status === WalletTxStatus.SUCCESS };

    if (payload.transferType !== 'in') {
      await this.prisma.subscriptionSepayTransaction.create({
        data: {
          sepayTransactionCode,
          amountVnd: payload.transferAmount,
          rawPayload: toJsonValue(payload),
          status: WalletTxStatus.FAILED,
        },
      });
      return { activated: false };
    }

    const haystack = `${payload.content ?? ''} ${payload.code ?? ''}`;
    const candidates = await this.prisma.subscriptionOrder.findMany({
      where: { status: SubscriptionOrderStatus.PENDING },
      include: { plan: true },
    });
    const order = candidates.find((o) => haystack.includes(o.code));

    if (!order || order.amountVnd !== payload.transferAmount) {
      await this.prisma.subscriptionSepayTransaction.create({
        data: {
          sepayTransactionCode,
          amountVnd: payload.transferAmount,
          rawPayload: toJsonValue(payload),
          status: WalletTxStatus.FAILED,
        },
      });
      return { activated: false };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.subscriptionSepayTransaction.create({
        data: {
          sepayTransactionCode,
          subscriptionOrderId: order.id,
          amountVnd: payload.transferAmount,
          rawPayload: toJsonValue(payload),
          status: WalletTxStatus.SUCCESS,
        },
      });

      // Mọi kỳ ACTIVE cũ của user -> EXPIRED (KHÔNG cộng dồn thời hạn, xem comment
      // SubscriptionMembership trong schema.prisma), rồi tạo kỳ mới từ gói vừa mua.
      await tx.subscriptionMembership.updateMany({
        where: {
          userId: order.userId,
          status: SubscriptionMembershipStatus.ACTIVE,
        },
        data: { status: SubscriptionMembershipStatus.EXPIRED },
      });

      const endsAt = new Date(
        Date.now() + order.plan.durationDays * 24 * 60 * 60 * 1000,
      );
      await tx.subscriptionMembership.create({
        data: {
          userId: order.userId,
          planId: order.planId,
          orderId: order.id,
          endsAt,
        },
      });

      await tx.subscriptionOrder.update({
        where: { id: order.id },
        data: { status: SubscriptionOrderStatus.SUCCESS },
      });

      // Gán role "subscription" — chỉ để nhóm/hiển thị (badge), KHÔNG giữ vai trò kiểm soát quyền
      // tải free (xem checkFreeDownloadEligibility, đọc thẳng SubscriptionMembership). Giữ nguyên
      // MEMBER song song — user vẫn tải/mua $P bình thường cho phần vượt quota.
      const role = await tx.role.findUnique({
        where: { slug: DEFAULT_ROLES.SUBSCRIPTION.slug },
      });
      if (role) {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: order.userId, roleId: role.id } },
          update: {},
          create: { userId: order.userId, roleId: role.id },
        });
      }
    });

    void this.userActivity.log(
      order.userId,
      UserActivityType.SUBSCRIPTION_PURCHASED,
      {
        planName: order.plan.name,
        amountVnd: payload.transferAmount,
      },
    );

    return { activated: true };
  }

  // ───────────────────────── Trạng thái + quota ─────────────────────────

  async getMyStatus(userId: string) {
    const membership = await this.findActiveMembership(userId);
    if (!membership) return null;

    const [totalDownloadsUsed, dailyDownloadsUsed] = await Promise.all([
      this.countDownloads(membership.id),
      this.countDownloads(membership.id, startOfToday()),
    ]);

    return {
      plan: membership.plan,
      startsAt: membership.startsAt,
      endsAt: membership.endsAt,
      totalDownloadsUsed,
      dailyDownloadsUsed,
    };
  }

  // Dùng bởi DownloadLinksService.unlockSmart() — chỉ ĐỌC, không có side-effect (không ghi
  // DownloadEvent ở đây, việc đó do DownloadLinksService làm sau khi biết eligible=true, để giữ
  // đúng 1 nơi duy nhất ghi DownloadEvent/DownloadGrant giống luồng $P hiện có).
  //
  // Quota đếm theo TỔNG SỐ LƯỢT TẢI — mỗi lần bấm tải đều tính 1, KỂ CẢ tải lại đúng link đã tải
  // trước đó (không có khái niệm "link đã mở khoá thì tải lại miễn phí không tính quota" như bản
  // đầu — đổi theo yêu cầu thực tế, khớp đúng cách priceP hoạt động ở unlock() $P: mỗi lần tải là 1
  // lần trừ). Vì vậy hàm này không cần biết downloadLinkId cụ thể nào, chỉ cần biết CÒN QUOTA hay không.
  async checkFreeDownloadEligibility(
    userId: string,
  ): Promise<{ eligible: boolean; membershipId?: string }> {
    const membership = await this.findActiveMembership(userId);
    if (!membership) return { eligible: false };

    if (membership.plan.totalDownloadLimit !== null) {
      const totalUsed = await this.countDownloads(membership.id);
      if (totalUsed >= membership.plan.totalDownloadLimit) {
        return { eligible: false };
      }
    }

    if (membership.plan.dailyDownloadLimit !== null) {
      const todayUsed = await this.countDownloads(
        membership.id,
        startOfToday(),
      );
      if (todayUsed >= membership.plan.dailyDownloadLimit) {
        return { eligible: false };
      }
    }

    return { eligible: true, membershipId: membership.id };
  }

  // ───────────────────────── Admin thu hồi (revoke) ─────────────────────────

  // Admin chấm dứt gói của user trước hạn (subscription.controller.ts, guard bằng permission
  // subscription.revoke). Khác cron expireEndedMemberships(): đây LUÔN chỉ có đúng 1 membership
  // ACTIVE để xử lý (design đảm bảo tối đa 1 ACTIVE/user), nên không cần re-check "còn ACTIVE nào
  // khác" như cron trước khi gỡ role.
  async revokeMembership(
    targetUserId: string,
    actorUserId: string,
  ): Promise<void> {
    const membership = await this.findActiveMembership(targetUserId);
    if (!membership) {
      throw new NotFoundException(
        'User này hiện không có gói Subscription nào đang hoạt động để thu hồi',
      );
    }

    await this.prisma.subscriptionMembership.update({
      where: { id: membership.id },
      data: { status: SubscriptionMembershipStatus.REVOKED },
    });

    const role = await this.prisma.role.findUnique({
      where: { slug: DEFAULT_ROLES.SUBSCRIPTION.slug },
    });
    if (role) {
      await this.prisma.userRole.deleteMany({
        where: { userId: targetUserId, roleId: role.id },
      });
    }

    void this.auditLog.log(actorUserId, AuditAction.SUBSCRIPTION_REVOKED, {
      targetType: 'user',
      targetId: targetUserId,
      metadata: {
        membershipId: membership.id,
        planId: membership.planId,
        planName: membership.plan.name,
      },
    });
  }

  private async findActiveMembership(userId: string) {
    return this.prisma.subscriptionMembership.findFirst({
      where: {
        userId,
        status: SubscriptionMembershipStatus.ACTIVE,
        endsAt: { gt: new Date() },
      },
      include: { plan: true },
      orderBy: { endsAt: 'desc' },
    });
  }

  private async countDownloads(
    membershipId: string,
    since?: Date,
  ): Promise<number> {
    return this.prisma.downloadEvent.count({
      where: {
        subscriptionMembershipId: membershipId,
        ...(since && { createdAt: { gte: since } }),
      },
    });
  }

  // ───────────────────────── Cron ─────────────────────────

  // Sweep mỗi phút (xem subscription-cron.service.ts) — hết hạn thì gỡ role "subscription", nhưng
  // CHỈ khi user đó thật sự không còn membership ACTIVE nào khác tại thời điểm gỡ (re-check ngay
  // trước khi xoá, không tin danh sách đã lấy lúc đầu hàm) — phòng trường hợp hiếm: user vừa mua gói
  // mới (activateFromOrder gán lại role) đúng lúc cron đang sweep kỳ cũ của họ. Dù race này có xảy
  // ra, hậu quả chỉ là role/badge tạm sai (cosmetic) — quyền tải free thật sự luôn đọc thẳng
  // SubscriptionMembership.status/endsAt, không phụ thuộc role này.
  async expireEndedMemberships(): Promise<number> {
    const ended = await this.prisma.subscriptionMembership.findMany({
      where: {
        status: SubscriptionMembershipStatus.ACTIVE,
        endsAt: { lt: new Date() },
      },
      select: { id: true, userId: true },
    });
    if (ended.length === 0) return 0;

    await this.prisma.subscriptionMembership.updateMany({
      where: {
        id: { in: ended.map((m) => m.id) },
        status: SubscriptionMembershipStatus.ACTIVE,
      },
      data: { status: SubscriptionMembershipStatus.EXPIRED },
    });

    const role = await this.prisma.role.findUnique({
      where: { slug: DEFAULT_ROLES.SUBSCRIPTION.slug },
    });
    if (role) {
      const userIds = [...new Set(ended.map((m) => m.userId))];
      for (const userId of userIds) {
        const stillActive = await this.prisma.subscriptionMembership.count({
          where: { userId, status: SubscriptionMembershipStatus.ACTIVE },
        });
        if (stillActive === 0) {
          await this.prisma.userRole.deleteMany({
            where: { userId, roleId: role.id },
          });
        }
      }
    }

    return ended.length;
  }
}
