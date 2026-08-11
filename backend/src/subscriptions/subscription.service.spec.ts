import { Test, TestingModule } from '@nestjs/testing';
import { WalletTxStatus } from '@prisma/client';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { SepayService } from '../sepay/sepay.service';
import { SubscriptionPlansService } from '../subscription-plans/subscription-plans.service';
import { UserActivityService } from '../user-activity/user-activity.service';
import type { SepayWebhookPayload } from '../sepay/sepay-webhook.types';

describe('SubscriptionService.checkFreeDownloadEligibility — quota (tổng + theo ngày)', () => {
  let service: SubscriptionService;
  let prisma: {
    subscriptionMembership: Record<string, jest.Mock>;
    downloadEvent: Record<string, jest.Mock>;
  };

  const activeMembership = (overrides: Record<string, unknown> = {}) => ({
    id: 'membership-1',
    userId: 'user-1',
    plan: { totalDownloadLimit: null, dailyDownloadLimit: null },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      subscriptionMembership: { findFirst: jest.fn() },
      downloadEvent: { findFirst: jest.fn(), findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prisma },
        { provide: SepayService, useValue: {} },
        { provide: SubscriptionPlansService, useValue: {} },
        { provide: UserActivityService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(SubscriptionService);
  });

  it('không có membership ACTIVE nào -> không eligible', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(null);
    const result = await service.checkFreeDownloadEligibility(
      'user-1',
      'link-1',
    );
    expect(result).toEqual({ eligible: false });
    // Không được đụng downloadEvent nếu đã biết chắc không có membership.
    expect(prisma.downloadEvent.findFirst).not.toHaveBeenCalled();
  });

  it('chỉ tìm membership ACTIVE và còn hạn (endsAt > now) — bảo vệ chống hồi quy nếu ai đó lỡ xoá filter', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(null);
    await service.checkFreeDownloadEligibility('user-1', 'link-1');
    const call = prisma.subscriptionMembership.findFirst.mock.calls[0] as [
      { where: { status: string; endsAt: { gt: Date } } },
    ];
    expect(call[0].where.status).toBe('ACTIVE');
    expect(call[0].where.endsAt.gt).toBeInstanceOf(Date);
  });

  it('link đã từng tải qua đúng kỳ Subscription này -> eligible, KHÔNG cần kiểm tra quota nữa (tải lại miễn phí)', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(
      activeMembership({
        plan: { totalDownloadLimit: 1, dailyDownloadLimit: 1 },
      }),
    );
    prisma.downloadEvent.findFirst.mockResolvedValue({ id: 'evt-1' });
    const result = await service.checkFreeDownloadEligibility(
      'user-1',
      'link-1',
    );
    expect(result).toEqual({ eligible: true, membershipId: 'membership-1' });
    // Không gọi findMany (đếm quota) vì đã eligible từ bước "đã từng tải".
    expect(prisma.downloadEvent.findMany).not.toHaveBeenCalled();
  });

  it('cả 2 giới hạn đều null (không giới hạn) -> luôn eligible', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(
      activeMembership(),
    );
    prisma.downloadEvent.findFirst.mockResolvedValue(null);
    const result = await service.checkFreeDownloadEligibility(
      'user-1',
      'link-new',
    );
    expect(result).toEqual({ eligible: true, membershipId: 'membership-1' });
  });

  it('còn dưới giới hạn TỔNG -> eligible', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(
      activeMembership({
        plan: { totalDownloadLimit: 2, dailyDownloadLimit: null },
      }),
    );
    prisma.downloadEvent.findFirst.mockResolvedValue(null);
    prisma.downloadEvent.findMany.mockResolvedValue([
      { downloadLinkId: 'link-a' },
    ]); // đã dùng 1/2
    const result = await service.checkFreeDownloadEligibility(
      'user-1',
      'link-new',
    );
    expect(result).toEqual({ eligible: true, membershipId: 'membership-1' });
  });

  it('đã CHẠM giới hạn TỔNG -> không eligible (fallback về $P ở tầng gọi)', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(
      activeMembership({
        plan: { totalDownloadLimit: 2, dailyDownloadLimit: null },
      }),
    );
    prisma.downloadEvent.findFirst.mockResolvedValue(null);
    prisma.downloadEvent.findMany.mockResolvedValue([
      { downloadLinkId: 'link-a' },
      { downloadLinkId: 'link-b' },
    ]); // đã dùng 2/2
    const result = await service.checkFreeDownloadEligibility(
      'user-1',
      'link-new',
    );
    expect(result).toEqual({ eligible: false });
  });

  it('còn dưới giới hạn THEO NGÀY -> eligible', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(
      activeMembership({
        plan: { totalDownloadLimit: null, dailyDownloadLimit: 3 },
      }),
    );
    prisma.downloadEvent.findFirst.mockResolvedValue(null);
    prisma.downloadEvent.findMany.mockResolvedValue([
      { downloadLinkId: 'link-a' },
    ]); // 1/3 hôm nay
    const result = await service.checkFreeDownloadEligibility(
      'user-1',
      'link-new',
    );
    expect(result).toEqual({ eligible: true, membershipId: 'membership-1' });
  });

  it('đã CHẠM giới hạn THEO NGÀY dù chưa chạm giới hạn tổng -> không eligible', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(
      activeMembership({
        plan: { totalDownloadLimit: 100, dailyDownloadLimit: 1 },
      }),
    );
    prisma.downloadEvent.findFirst.mockResolvedValue(null);
    // findMany được gọi 2 lần: lần 1 kiểm tra tổng (chưa chạm), lần 2 kiểm tra theo ngày (đã chạm).
    prisma.downloadEvent.findMany
      .mockResolvedValueOnce([{ downloadLinkId: 'link-a' }]) // tổng: 1/100, chưa chạm
      .mockResolvedValueOnce([{ downloadLinkId: 'link-a' }]); // hôm nay: 1/1, đã chạm
    const result = await service.checkFreeDownloadEligibility(
      'user-1',
      'link-new',
    );
    expect(result).toEqual({ eligible: false });
  });
});

describe('SubscriptionService.matchAndActivateFromWebhook — đối soát SePay cho Subscription', () => {
  let service: SubscriptionService;
  let prisma: {
    subscriptionSepayTransaction: Record<string, jest.Mock>;
    subscriptionOrder: Record<string, jest.Mock>;
    subscriptionMembership: Record<string, jest.Mock>;
    role: Record<string, jest.Mock>;
    userRole: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let userActivity: { log: jest.Mock };

  const basePayload: SepayWebhookPayload = {
    id: 999,
    transferType: 'in',
    transferAmount: 300000,
    content: 'CK toi SUB482134 xin chao',
  };

  const pendingOrder = {
    id: 'order-1',
    userId: 'user-1',
    planId: 'plan-1',
    code: 'SUB482134',
    amountVnd: 300000,
    status: 'PENDING',
    plan: { id: 'plan-1', name: 'Gói 1 ngày', durationDays: 1 },
  };

  beforeEach(async () => {
    prisma = {
      subscriptionSepayTransaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      subscriptionOrder: { findMany: jest.fn(), update: jest.fn() },
      subscriptionMembership: { updateMany: jest.fn(), create: jest.fn() },
      role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-sub' }) },
      userRole: { upsert: jest.fn() },
      // $transaction gọi thẳng callback với CÙNG object prisma (đủ cho unit test — không cần
      // isolation thật, chỉ cần các lệnh bên trong callback trỏ đúng vào mock đã set up).
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    userActivity = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prisma },
        { provide: SepayService, useValue: {} },
        { provide: SubscriptionPlansService, useValue: {} },
        { provide: UserActivityService, useValue: userActivity },
      ],
    }).compile();

    service = module.get(SubscriptionService);
  });

  it('webhook trùng lặp (đã xử lý SUCCESS trước đó) -> trả activated:true NGAY, không xử lý lại', async () => {
    prisma.subscriptionSepayTransaction.findUnique.mockResolvedValue({
      status: WalletTxStatus.SUCCESS,
    });
    const result = await service.matchAndActivateFromWebhook(basePayload);
    expect(result).toEqual({ activated: true });
    expect(prisma.subscriptionOrder.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('webhook trùng lặp nhưng lần trước FAILED -> trả activated:false, không xử lý lại', async () => {
    prisma.subscriptionSepayTransaction.findUnique.mockResolvedValue({
      status: WalletTxStatus.FAILED,
    });
    const result = await service.matchAndActivateFromWebhook(basePayload);
    expect(result).toEqual({ activated: false });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('transferType "out" (tiền đi ra) -> không kích hoạt, ghi log FAILED, không đụng transaction/order', async () => {
    prisma.subscriptionSepayTransaction.findUnique.mockResolvedValue(null);
    const result = await service.matchAndActivateFromWebhook({
      ...basePayload,
      transferType: 'out',
    });
    expect(result).toEqual({ activated: false });
    const failedCall = prisma.subscriptionSepayTransaction.create.mock
      .calls[0] as [{ data: { status: WalletTxStatus } }];
    expect(failedCall[0].data.status).toBe(WalletTxStatus.FAILED);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('không có đơn PENDING nào khớp nội dung chuyển khoản -> không kích hoạt', async () => {
    prisma.subscriptionSepayTransaction.findUnique.mockResolvedValue(null);
    prisma.subscriptionOrder.findMany.mockResolvedValue([]); // không có đơn PENDING nào
    const result = await service.matchAndActivateFromWebhook(basePayload);
    expect(result).toEqual({ activated: false });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('khớp nội dung nhưng SAI số tiền -> không kích hoạt (không tự cộng nhầm)', async () => {
    prisma.subscriptionSepayTransaction.findUnique.mockResolvedValue(null);
    prisma.subscriptionOrder.findMany.mockResolvedValue([
      { ...pendingOrder, amountVnd: 999999 },
    ]);
    const result = await service.matchAndActivateFromWebhook(basePayload);
    expect(result).toEqual({ activated: false });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('khớp đúng nội dung + số tiền -> kích hoạt: hết hạn kỳ cũ, tạo kỳ mới, cập nhật order, gán role', async () => {
    prisma.subscriptionSepayTransaction.findUnique.mockResolvedValue(null);
    prisma.subscriptionOrder.findMany.mockResolvedValue([pendingOrder]);

    const result = await service.matchAndActivateFromWebhook(basePayload);

    expect(result).toEqual({ activated: true });
    const sepayTxCall = prisma.subscriptionSepayTransaction.create.mock
      .calls[0] as [
      { data: { sepayTransactionCode: string; status: WalletTxStatus } },
    ];
    expect(sepayTxCall[0].data.sepayTransactionCode).toBe('999');
    expect(sepayTxCall[0].data.status).toBe(WalletTxStatus.SUCCESS);

    expect(prisma.subscriptionMembership.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });

    const membershipCall = prisma.subscriptionMembership.create.mock
      .calls[0] as [
      {
        data: { userId: string; planId: string; orderId: string; endsAt: Date };
      },
    ];
    expect(membershipCall[0].data.userId).toBe('user-1');
    expect(membershipCall[0].data.planId).toBe('plan-1');
    expect(membershipCall[0].data.orderId).toBe('order-1');
    // durationDays=1 -> endsAt phải ~24h sau (sai số vài giây cho thời gian chạy test).
    const createdEndsAt = membershipCall[0].data.endsAt;
    const hoursDiff = (createdEndsAt.getTime() - Date.now()) / (60 * 60 * 1000);
    expect(hoursDiff).toBeGreaterThan(23.9);
    expect(hoursDiff).toBeLessThan(24.1);

    expect(prisma.subscriptionOrder.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'SUCCESS' },
    });
    expect(prisma.userRole.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: 'user-1', roleId: 'role-sub' },
      }),
    );
    expect(userActivity.log).toHaveBeenCalledWith(
      'user-1',
      'SUBSCRIPTION_PURCHASED',
      expect.any(Object),
    );
  });

  it('role "subscription" chưa tồn tại trong DB (chưa seed) -> vẫn kích hoạt membership, chỉ bỏ qua bước gán role', async () => {
    prisma.subscriptionSepayTransaction.findUnique.mockResolvedValue(null);
    prisma.subscriptionOrder.findMany.mockResolvedValue([pendingOrder]);
    prisma.role.findUnique.mockResolvedValue(null);

    const result = await service.matchAndActivateFromWebhook(basePayload);

    expect(result).toEqual({ activated: true });
    expect(prisma.subscriptionMembership.create).toHaveBeenCalled();
    expect(prisma.userRole.upsert).not.toHaveBeenCalled();
  });
});

describe('SubscriptionService.expireEndedMemberships — cron hết hạn', () => {
  let service: SubscriptionService;
  let prisma: {
    subscriptionMembership: Record<string, jest.Mock>;
    role: Record<string, jest.Mock>;
    userRole: Record<string, jest.Mock>;
  };

  beforeEach(async () => {
    prisma = {
      subscriptionMembership: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-sub' }) },
      userRole: { deleteMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prisma },
        { provide: SepayService, useValue: {} },
        { provide: SubscriptionPlansService, useValue: {} },
        { provide: UserActivityService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(SubscriptionService);
  });

  it('không có membership nào hết hạn -> trả 0, không đụng gì khác', async () => {
    prisma.subscriptionMembership.findMany.mockResolvedValue([]);
    const count = await service.expireEndedMemberships();
    expect(count).toBe(0);
    expect(prisma.subscriptionMembership.updateMany).not.toHaveBeenCalled();
    expect(prisma.userRole.deleteMany).not.toHaveBeenCalled();
  });

  it('có membership hết hạn và user KHÔNG còn kỳ ACTIVE nào khác -> đánh dấu EXPIRED + gỡ role', async () => {
    prisma.subscriptionMembership.findMany.mockResolvedValue([
      { id: 'm1', userId: 'user-1' },
    ]);
    prisma.subscriptionMembership.count.mockResolvedValue(0); // không còn kỳ ACTIVE nào khác

    const count = await service.expireEndedMemberships();

    expect(count).toBe(1);
    expect(prisma.subscriptionMembership.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['m1'] }, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });
    expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', roleId: 'role-sub' },
    });
  });

  it('user vừa mua gói mới đúng lúc cron quét (vẫn còn 1 kỳ ACTIVE khác) -> KHÔNG gỡ role (tránh race)', async () => {
    prisma.subscriptionMembership.findMany.mockResolvedValue([
      { id: 'm1', userId: 'user-1' },
    ]);
    prisma.subscriptionMembership.count.mockResolvedValue(1); // vẫn còn 1 kỳ ACTIVE khác (vừa mua)

    const count = await service.expireEndedMemberships();

    expect(count).toBe(1);
    expect(prisma.subscriptionMembership.updateMany).toHaveBeenCalled();
    expect(prisma.userRole.deleteMany).not.toHaveBeenCalled();
  });

  it('nhiều user hết hạn cùng lúc, mỗi user chỉ gỡ role đúng 1 lần dù có nhiều membership hết hạn', async () => {
    prisma.subscriptionMembership.findMany.mockResolvedValue([
      { id: 'm1', userId: 'user-1' },
      { id: 'm2', userId: 'user-1' }, // trùng userId (lý thuyết không xảy ra do design 1 ACTIVE/user, nhưng vẫn test an toàn)
      { id: 'm3', userId: 'user-2' },
    ]);
    prisma.subscriptionMembership.count.mockResolvedValue(0);

    await service.expireEndedMemberships();

    expect(prisma.userRole.deleteMany).toHaveBeenCalledTimes(2); // user-1 (1 lần, không lặp), user-2
  });
});
