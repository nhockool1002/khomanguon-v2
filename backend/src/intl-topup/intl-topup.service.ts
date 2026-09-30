import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  IntlTopupStatus,
  Prisma,
  WalletTxStatus,
  WalletTxType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { WalletGateway } from '../realtime/wallet.gateway';
import { SepayService } from '../sepay/sepay.service';
import { SiteSettingsService } from '../settings/site-settings.service';
import { IntlTopupInvoiceService } from './intl-topup-invoice.service';
import {
  DEFAULT_INTL_PAYMENT_SETTINGS,
  INTL_CODE_ALPHABET,
  INTL_CODE_LENGTH,
  INTL_CODE_PREFIX,
  INTL_PAYMENT_SETTING_KEY,
  type IntlPaymentSettings,
} from './intl-topup.types';
import type { UpdateIntlPaymentSettingsDto } from './dto/update-intl-payment-settings.dto';
import type { ApproveIntlTopupDto } from './dto/approve-intl-topup.dto';

function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const OPEN_STATUSES: IntlTopupStatus[] = [
  IntlTopupStatus.AWAITING_PAYMENT,
  IntlTopupStatus.PENDING,
];

const orderUserSelect = {
  id: true,
  displayName: true,
  email: true,
} satisfies Prisma.UserSelect;

const adminOrderSelect = {
  id: true,
  code: true,
  amountUsd: true,
  amountP: true,
  status: true,
  expiresAt: true,
  payerEmail: true,
  paidClaimedAt: true,
  termsAcceptedAt: true,
  receivedUsdCents: true,
  creditedP: true,
  bmcTransactionRef: true,
  reviewedAt: true,
  rejectReason: true,
  invoiceNumber: true,
  createdAt: true,
  user: { select: orderUserSelect },
  reviewedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.IntlTopupOrderSelect;

const ownOrderSelect = {
  id: true,
  code: true,
  amountUsd: true,
  amountP: true,
  status: true,
  expiresAt: true,
  payerEmail: true,
  paidClaimedAt: true,
  receivedUsdCents: true,
  creditedP: true,
  reviewedAt: true,
  rejectReason: true,
  invoiceNumber: true,
  createdAt: true,
} satisfies Prisma.IntlTopupOrderSelect;

// Nạp $P quốc tế qua Buy Me a Coffee — đối soát TAY. Hoàn toàn tách khỏi SePay: bảng/mã/API riêng,
// chỉ ĐỌC tỉ giá cơ bản VNĐ/$P từ SepayService để tính $P mặc định của gói, và chỉ dùng chung
// Wallet/WalletTransaction (type INTL_TOPUP) ở bước Admin duyệt.
@Injectable()
export class IntlTopupService {
  private readonly logger = new Logger(IntlTopupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly walletGateway: WalletGateway,
    private readonly sepayService: SepayService,
    private readonly invoiceService: IntlTopupInvoiceService,
    private readonly siteSettings: SiteSettingsService,
  ) {}

  // Công tắc tổng ở Cài đặt chung (GeneralSettings.intlPaymentEnabled).
  private async isEnabled(): Promise<boolean> {
    return (await this.siteSettings.getGeneralSettings()).intlPaymentEnabled;
  }

  // ───────────────────────── Cài đặt + gói ─────────────────────────

  async getSettings(): Promise<IntlPaymentSettings> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: INTL_PAYMENT_SETTING_KEY },
    });
    if (!row) return DEFAULT_INTL_PAYMENT_SETTINGS;
    return {
      ...DEFAULT_INTL_PAYMENT_SETTINGS,
      ...(row.value as Partial<IntlPaymentSettings>),
    };
  }

  private listPackages(onlyActive: boolean) {
    return this.prisma.intlTopupPackage.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { amountUsd: 'asc' }],
    });
  }

  // Trang Admin — kèm tỉ giá cơ bản VNĐ/$P của SePay (chỉ đọc) để FE tự điền $P khi nhập USD.
  async getAdminSettings() {
    const [settings, packages, { baseRateVndPerP }] = await Promise.all([
      this.getSettings(),
      this.listPackages(false),
      this.sepayService.getTopupPresets(),
    ]);
    return { ...settings, domesticBaseRateVndPerP: baseRateVndPerP, packages };
  }

  async updateSettings(dto: UpdateIntlPaymentSettingsDto) {
    const { packages, ...rest } = dto;
    const next: IntlPaymentSettings = {
      ...(await this.getSettings()),
      ...Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined),
      ),
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.siteSetting.upsert({
        where: { key: INTL_PAYMENT_SETTING_KEY },
        update: { value: toJsonValue(next) },
        create: { key: INTL_PAYMENT_SETTING_KEY, value: toJsonValue(next) },
      });
      if (packages !== undefined) {
        await tx.intlTopupPackage.deleteMany({});
        await tx.intlTopupPackage.createMany({
          data: packages.map((p, i) => ({
            amountUsd: p.amountUsd,
            amountP: p.amountP,
            bmcExtraUrl: p.bmcExtraUrl?.trim() || null,
            isActive: p.isActive,
            sortOrder: i,
          })),
        });
      }
    });
    return this.getAdminSettings();
  }

  // Trang Nạp $P (user đã đăng nhập) — gói đang bật + link BMC, không lộ thông tin khác. enabled=false
  // thì FE ẩn tab International (vẫn trả gói rỗng để không lộ cấu hình khi đang tắt).
  async getPublicConfig() {
    const [settings, packages, enabled] = await Promise.all([
      this.getSettings(),
      this.listPackages(true),
      this.isEnabled(),
    ]);
    if (!enabled) {
      return {
        enabled,
        bmcPageUrl: '',
        paymentWindowHours: settings.paymentWindowHours,
        packages: [],
      };
    }
    return {
      enabled,
      bmcPageUrl: settings.bmcPageUrl,
      paymentWindowHours: settings.paymentWindowHours,
      packages: packages.map((p) => ({
        id: p.id,
        amountUsd: p.amountUsd,
        amountP: p.amountP,
        bmcUrl: p.bmcExtraUrl || settings.bmcPageUrl,
      })),
    };
  }

  // ───────────────────────── Luồng user ─────────────────────────

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      let suffix = '';
      for (let i = 0; i < INTL_CODE_LENGTH; i++) {
        suffix += INTL_CODE_ALPHABET[randomInt(INTL_CODE_ALPHABET.length)];
      }
      const code = `${INTL_CODE_PREFIX}${suffix}`;
      const existing = await this.prisma.intlTopupOrder.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    throw new Error('Could not generate a unique reference code — try again');
  }

  // Chỉ chặn TẠO yêu cầu mới khi tắt — claimPaid/cancel/duyệt vẫn chạy để khách đã trả tiền không bị kẹt.
  async createOrder(userId: string, packageId: string, ip: string | null) {
    if (!(await this.isEnabled())) {
      throw new BadRequestException(
        'International top-up is currently unavailable',
      );
    }
    const settings = await this.getSettings();
    const pkg = await this.prisma.intlTopupPackage.findUnique({
      where: { id: packageId },
    });
    if (!pkg || !pkg.isActive) {
      throw new BadRequestException('This package is no longer available');
    }

    const openCount = await this.prisma.intlTopupOrder.count({
      where: { userId, status: { in: OPEN_STATUSES } },
    });
    if (openCount >= settings.maxOpenOrdersPerUser) {
      throw new BadRequestException(
        `You already have ${openCount} open top-up request(s). Complete or cancel them before creating a new one.`,
      );
    }

    const now = new Date();
    const order = await this.prisma.intlTopupOrder.create({
      data: {
        code: await this.generateUniqueCode(),
        userId,
        amountUsd: pkg.amountUsd,
        amountP: pkg.amountP,
        expiresAt: new Date(
          now.getTime() + settings.paymentWindowHours * 3600_000,
        ),
        termsAcceptedAt: now,
        termsIp: ip,
      },
      select: ownOrderSelect,
    });
    return { ...order, bmcUrl: pkg.bmcExtraUrl || settings.bmcPageUrl };
  }

  private async getOwnOpenOrder(userId: string, id: string) {
    const order = await this.prisma.intlTopupOrder.findUnique({
      where: { id },
      include: { user: { select: orderUserSelect } },
    });
    if (!order) throw new NotFoundException('Top-up request not found');
    if (order.userId !== userId) {
      throw new ForbiddenException('You cannot access this top-up request');
    }
    return order;
  }

  // AWAITING_PAYMENT -> PENDING + gửi mail user & Admin. Quá hạn thì đánh EXPIRED luôn (không đợi cron).
  async claimPaid(userId: string, id: string, payerEmail: string) {
    const order = await this.getOwnOpenOrder(userId, id);
    if (order.status !== IntlTopupStatus.AWAITING_PAYMENT) {
      throw new BadRequestException(
        'This request is no longer awaiting payment',
      );
    }
    if (order.expiresAt < new Date()) {
      await this.prisma.intlTopupOrder.updateMany({
        where: { id, status: IntlTopupStatus.AWAITING_PAYMENT },
        data: { status: IntlTopupStatus.EXPIRED },
      });
      throw new BadRequestException(
        'This request has expired. Please create a new one — if you already paid, contact us via Feedback with your reference code.',
      );
    }

    const email = payerEmail.trim().toLowerCase();
    const result = await this.prisma.intlTopupOrder.updateMany({
      where: { id, status: IntlTopupStatus.AWAITING_PAYMENT },
      data: {
        status: IntlTopupStatus.PENDING,
        payerEmail: email,
        paidClaimedAt: new Date(),
      },
    });
    if (result.count === 0) {
      throw new BadRequestException(
        'This request is no longer awaiting payment',
      );
    }

    const vars = {
      displayName: order.user.displayName,
      userEmail: order.user.email,
      code: order.code,
      amountUsd: String(order.amountUsd),
      amountP: String(order.amountP),
      payerEmail: email,
    };
    // Mail là side-effect phụ — lỗi gửi không được làm hỏng việc chuyển PENDING (đã ghi DB).
    void this.safeSend('intlTopupPendingUser', vars, [order.user.email]);
    void this.mailService
      .getNotifyEmail()
      .then((adminEmail) =>
        this.safeSend('intlTopupPendingAdmin', vars, [adminEmail]),
      );

    return this.prisma.intlTopupOrder.findUniqueOrThrow({
      where: { id },
      select: ownOrderSelect,
    });
  }

  async cancel(userId: string, id: string) {
    await this.getOwnOpenOrder(userId, id);
    const result = await this.prisma.intlTopupOrder.updateMany({
      where: { id, status: IntlTopupStatus.AWAITING_PAYMENT },
      data: { status: IntlTopupStatus.EXPIRED },
    });
    if (result.count === 0) {
      throw new BadRequestException(
        'Only requests awaiting payment can be cancelled',
      );
    }
  }

  async listOwn(userId: string) {
    return this.prisma.intlTopupOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: ownOrderSelect,
    });
  }

  // ───────────────────────── Luồng Admin ─────────────────────────

  async listForAdmin(query: {
    status?: IntlTopupStatus;
    q?: string;
    page: number;
    limit: number;
  }) {
    const take = Math.min(Math.max(query.limit, 1), 50);
    const skip = (Math.max(query.page, 1) - 1) * take;
    const where: Prisma.IntlTopupOrderWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.q && {
        OR: [
          { code: { contains: query.q, mode: 'insensitive' } },
          { payerEmail: { contains: query.q, mode: 'insensitive' } },
          { bmcTransactionRef: { contains: query.q, mode: 'insensitive' } },
          { user: { email: { contains: query.q, mode: 'insensitive' } } },
          { user: { displayName: { contains: query.q, mode: 'insensitive' } } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.intlTopupOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: adminOrderSelect,
      }),
      this.prisma.intlTopupOrder.count({ where }),
    ]);
    return { items, total };
  }

  // PENDING -> APPROVED + cộng $P, tất cả trong 1 transaction. updateMany có điều kiện status=PENDING
  // là khoá chống cộng đôi: Admin bấm 2 lần / 2 Admin duyệt cùng lúc thì chỉ 1 lần cập nhật được.
  async approve(id: string, adminUserId: string, dto: ApproveIntlTopupDto) {
    const receivedUsdCents = Math.round(dto.receivedUsd * 100);
    const approvedAt = new Date();
    const order = await this.prisma.intlTopupOrder.findUnique({
      where: { id },
      select: {
        code: true,
        userId: true,
        amountUsd: true,
        amountP: true,
        payerEmail: true,
      },
    });
    if (!order) throw new NotFoundException('Không tìm thấy yêu cầu nạp');
    const admin = await this.prisma.user.findUnique({
      where: { id: adminUserId },
      select: { displayName: true },
    });
    const invoiceNumber = `INV-${approvedAt.toISOString().slice(0, 10).replace(/-/g, '')}-${order.code.slice(INTL_CODE_PREFIX.length)}`;

    // Ghi chú đầy đủ trên WalletTransaction để trang Quản lý Giao Dịch đối soát được ngay (không cần
    // mở trang Duyệt nạp quốc tế): mã đơn, invoice, mã giao dịch + email trên BMC, số USD thực nhận so
    // với gói, $P, người duyệt.
    const note = [
      `Buy Me a Coffee ${order.code}`,
      `Invoice ${invoiceNumber}`,
      `BMC ref ${dto.bmcTransactionRef.trim()}`,
      `Payer ${order.payerEmail ?? '—'}`,
      `Nhận $${(receivedUsdCents / 100).toFixed(2)} (gói $${order.amountUsd} = ${order.amountP} $P)`,
      `Cộng ${dto.creditedP} $P`,
      `Duyệt bởi ${admin?.displayName ?? adminUserId}`,
    ].join(' · ');

    const balanceAfter = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.intlTopupOrder.updateMany({
        where: { id, status: IntlTopupStatus.PENDING },
        data: {
          status: IntlTopupStatus.APPROVED,
          receivedUsdCents,
          creditedP: dto.creditedP,
          bmcTransactionRef: dto.bmcTransactionRef.trim(),
          reviewedById: adminUserId,
          reviewedAt: approvedAt,
          invoiceNumber,
        },
      });
      if (claimed.count === 0) {
        throw new ConflictException(
          'Yêu cầu không còn ở trạng thái Chờ duyệt (có thể đã được xử lý)',
        );
      }

      const wallet = await tx.wallet.upsert({
        where: { userId: order.userId },
        update: {},
        create: { userId: order.userId, balance: 0 },
      });
      const newBalance = wallet.balance + dto.creditedP;
      const walletTransaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTxType.INTL_TOPUP,
          amount: dto.creditedP,
          balanceAfter: newBalance,
          status: WalletTxStatus.SUCCESS,
          referenceType: 'intl_topup',
          referenceId: id,
          note,
        },
      });
      await tx.wallet.update({
        where: { userId: order.userId },
        data: { balance: newBalance },
      });
      await tx.intlTopupOrder.update({
        where: { id },
        data: { walletTransactionId: walletTransaction.id },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: adminUserId,
          action: AuditAction.INTL_TOPUP_APPROVED,
          targetType: 'intl_topup_order',
          targetId: id,
          metadata: {
            code: order.code,
            userId: order.userId,
            receivedUsdCents,
            creditedP: dto.creditedP,
            bmcTransactionRef: dto.bmcTransactionRef.trim(),
          },
        },
      });
      return newBalance;
    });

    this.walletGateway.emitWalletUpdated(order.userId, {
      balance: balanceAfter,
    });

    // $P đã cộng xong — lỗi tạo PDF/gửi mail không được rollback, chỉ báo lại cho Admin.
    let mailError: string | null = null;
    try {
      await this.sendApprovedMail(id);
    } catch (err) {
      mailError = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Gửi mail/invoice nạp quốc tế ${order.code} thất bại: ${mailError}`,
      );
    }

    const updated = await this.prisma.intlTopupOrder.findUniqueOrThrow({
      where: { id },
      select: adminOrderSelect,
    });
    return { order: updated, mailError };
  }

  async reject(id: string, adminUserId: string, reason: string) {
    const order = await this.prisma.intlTopupOrder.findUnique({
      where: { id },
      include: { user: { select: orderUserSelect } },
    });
    if (!order) throw new NotFoundException('Không tìm thấy yêu cầu nạp');

    const result = await this.prisma.intlTopupOrder.updateMany({
      where: { id, status: IntlTopupStatus.PENDING },
      data: {
        status: IntlTopupStatus.REJECTED,
        rejectReason: reason.trim(),
        reviewedById: adminUserId,
        reviewedAt: new Date(),
      },
    });
    if (result.count === 0) {
      throw new ConflictException(
        'Yêu cầu không còn ở trạng thái Chờ duyệt (có thể đã được xử lý)',
      );
    }
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminUserId,
        action: AuditAction.INTL_TOPUP_REJECTED,
        targetType: 'intl_topup_order',
        targetId: id,
        metadata: {
          code: order.code,
          userId: order.userId,
          reason: reason.trim(),
        },
      },
    });

    void this.safeSend(
      'intlTopupRejected',
      {
        displayName: order.user.displayName,
        code: order.code,
        amountUsd: String(order.amountUsd),
        reason: reason.trim(),
      },
      [order.user.email],
    );

    return this.prisma.intlTopupOrder.findUniqueOrThrow({
      where: { id },
      select: adminOrderSelect,
    });
  }

  // ───────────────────────── Invoice ─────────────────────────

  private async buildInvoice(id: string) {
    const order = await this.prisma.intlTopupOrder.findUnique({
      where: { id },
      include: { user: { select: orderUserSelect } },
    });
    if (
      !order ||
      order.status !== IntlTopupStatus.APPROVED ||
      !order.invoiceNumber ||
      !order.reviewedAt ||
      order.receivedUsdCents === null ||
      order.creditedP === null
    ) {
      throw new NotFoundException('Invoice not available for this request');
    }
    const settings = await this.getSettings();
    const pdf = await this.invoiceService.render({
      invoiceNumber: order.invoiceNumber,
      code: order.code,
      approvedAt: order.reviewedAt,
      seller: { name: settings.sellerName, email: settings.sellerEmail },
      buyer: {
        name: order.user.displayName,
        email: order.user.email,
        userId: order.user.id,
      },
      payerEmail: order.payerEmail,
      bmcTransactionRef: order.bmcTransactionRef ?? '—',
      packageUsd: order.amountUsd,
      receivedUsdCents: order.receivedUsdCents,
      creditedP: order.creditedP,
      termsAcceptedAt: order.termsAcceptedAt,
      termsIp: order.termsIp,
    });
    return { order, pdf, filename: `${order.invoiceNumber}.pdf` };
  }

  // Chủ đơn hoặc Admin có quyền payment.intl.manage mới tải được.
  async getInvoice(id: string, requesterId: string, isAdmin: boolean) {
    const owner = await this.prisma.intlTopupOrder.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!owner) throw new NotFoundException('Top-up request not found');
    if (!isAdmin && owner.userId !== requesterId) {
      throw new ForbiddenException('You cannot access this invoice');
    }
    const { pdf, filename } = await this.buildInvoice(id);
    return { pdf, filename };
  }

  private async sendApprovedMail(id: string) {
    const { order, pdf, filename } = await this.buildInvoice(id);
    const adminEmail = await this.mailService.getNotifyEmail();
    await this.mailService.sendIntlTopupMail(
      'intlTopupApproved',
      {
        displayName: order.user.displayName,
        code: order.code,
        invoiceNumber: order.invoiceNumber ?? '',
        receivedUsd: ((order.receivedUsdCents ?? 0) / 100).toFixed(2),
        creditedP: String(order.creditedP),
        approvedAt: `${(order.reviewedAt ?? new Date()).toISOString().replace('T', ' ').slice(0, 19)} UTC`,
      },
      [order.user.email, adminEmail],
      [{ filename, content: pdf, contentType: 'application/pdf' }],
    );
  }

  private async safeSend(
    kind: Parameters<MailService['sendIntlTopupMail']>[0],
    vars: Record<string, string>,
    to: string[],
  ) {
    try {
      await this.mailService.sendIntlTopupMail(kind, vars, to);
    } catch (err) {
      this.logger.warn(
        `Gửi mail "${kind}" thất bại: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ───────────────────────── Cron ─────────────────────────

  // Chỉ AWAITING_PAYMENT hết hạn — PENDING (user đã báo trả tiền) luôn chờ Admin xử lý, không tự huỷ.
  async expireStaleOrders(): Promise<number> {
    const result = await this.prisma.intlTopupOrder.updateMany({
      where: {
        status: IntlTopupStatus.AWAITING_PAYMENT,
        expiresAt: { lt: new Date() },
      },
      data: { status: IntlTopupStatus.EXPIRED },
    });
    return result.count;
  }
}
