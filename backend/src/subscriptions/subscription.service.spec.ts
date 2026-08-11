import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WalletTxStatus } from '@prisma/client';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { SepayService } from '../sepay/sepay.service';
import { SubscriptionPlansService } from '../subscription-plans/subscription-plans.service';
import { UserActivityService } from '../user-activity/user-activity.service';
import { AuditLogService } from '../audit-log/audit-log.service';
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
      downloadEvent: { count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prisma },
        { provide: SepayService, useValue: {} },
        { provide: SubscriptionPlansService, useValue: {} },
        { provide: UserActivityService, useValue: { log: jest.fn() } },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(SubscriptionService);
  });

  it('không có membership ACTIVE nào -> không eligible', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(null);
    const result = await service.checkFreeDownloadEligibility('user-1');
    expect(result).toEqual({ eligible: false });
    // Không được đụng downloadEvent nếu đã biết chắc không có membership.
    expect(prisma.downloadEvent.count).not.toHaveBeenCalled();
  });

  it('chỉ tìm membership ACTIVE và còn hạn (endsAt > now) — bảo vệ chống hồi quy nếu ai đó lỡ xoá filter', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(null);
    await service.checkFreeDownloadEligibility('user-1');
    const call = prisma.subscriptionMembership.findFirst.mock.calls[0] as [
      { where: { status: string; endsAt: { gt: Date } } },
    ];
    expect(call[0].where.status).toBe('ACTIVE');
    expect(call[0].where.endsAt.gt).toBeInstanceOf(Date);
  });

  it('mỗi lần tải đều tính 1 lượt — kể cả tải lại đúng link đã từng tải trước đó (không có ngoại lệ "link cũ tải lại miễn phí")', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(
      activeMembership({
        plan: { totalDownloadLimit: 2, dailyDownloadLimit: null },
      }),
    );
    // Giả lập: user đã tải link-1 một lần (1 DownloadEvent), giờ tải LẠI đúng link-1 -> vẫn phải
    // tính vào quota, không có nhánh "đã từng tải link này -> miễn phí" nữa.
    prisma.downloadEvent.count.mockResolvedValue(1); // đã dùng 1/2
    const result = await service.checkFreeDownloadEligibility('user-1');
    expect(result).toEqual({ eligible: true, membershipId: 'membership-1' });
  });

  it('cả 2 giới hạn đều null (không giới hạn) -> luôn eligible, không cần đếm quota', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(
      activeMembership(),
    );
    const result = await service.checkFreeDownloadEligibility('user-1');
    expect(result).toEqual({ eligible: true, membershipId: 'membership-1' });
    expect(prisma.downloadEvent.count).not.toHaveBeenCalled();
  });

  it('còn dưới giới hạn TỔNG -> eligible', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(
      activeMembership({
        plan: { totalDownloadLimit: 2, dailyDownloadLimit: null },
      }),
    );
    prisma.downloadEvent.count.mockResolvedValue(1); // đã dùng 1/2
    const result = await service.checkFreeDownloadEligibility('user-1');
    expect(result).toEqual({ eligible: true, membershipId: 'membership-1' });
  });

  it('đã CHẠM giới hạn TỔNG -> không eligible (fallback về $P ở tầng gọi)', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(
      activeMembership({
        plan: { totalDownloadLimit: 2, dailyDownloadLimit: null },
      }),
    );
    prisma.downloadEvent.count.mockResolvedValue(2); // đã dùng 2/2
    const result = await service.checkFreeDownloadEligibility('user-1');
    expect(result).toEqual({ eligible: false });
  });

  it('còn dưới giới hạn THEO NGÀY -> eligible', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(
      activeMembership({
        plan: { totalDownloadLimit: null, dailyDownloadLimit: 3 },
      }),
    );
    prisma.downloadEvent.count.mockResolvedValue(1); // 1/3 hôm nay
    const result = await service.checkFreeDownloadEligibility('user-1');
    expect(result).toEqual({ eligible: true, membershipId: 'membership-1' });
  });

  it('đã CHẠM giới hạn THEO NGÀY dù chưa chạm giới hạn tổng -> không eligible', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(
      activeMembership({
        plan: { totalDownloadLimit: 100, dailyDownloadLimit: 1 },
      }),
    );
    // count được gọi 2 lần: lần 1 kiểm tra tổng (chưa chạm), lần 2 kiểm tra theo ngày (đã chạm).
    prisma.downloadEvent.count
      .mockResolvedValueOnce(1) // tổng: 1/100, chưa chạm
      .mockResolvedValueOnce(1); // hôm nay: 1/1, đã chạm
    const result = await service.checkFreeDownloadEligibility('user-1');
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
        { provide: AuditLogService, useValue: { log: jest.fn() } },
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
        { provide: AuditLogService, useValue: { log: jest.fn() } },
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

describe('SubscriptionService.createOrder — chặn mua chồng gói', () => {
  let service: SubscriptionService;
  let prisma: {
    subscriptionMembership: Record<string, jest.Mock>;
    subscriptionOrder: Record<string, jest.Mock>;
  };
  let subscriptionPlansService: { findActiveByIdOrThrow: jest.Mock };
  let sepayService: { getConfig: jest.Mock; buildVietQrUrl: jest.Mock };

  const plan = { id: 'plan-1', priceVnd: 300000 };

  beforeEach(async () => {
    prisma = {
      subscriptionMembership: { findFirst: jest.fn() },
      subscriptionOrder: {
        findUnique: jest.fn().mockResolvedValue(null), // mã sinh ra chưa tồn tại -> không cần retry
        create: jest.fn().mockResolvedValue({
          id: 'order-1',
          code: 'SUB123456',
          amountVnd: 300000,
        }),
      },
    };
    subscriptionPlansService = {
      findActiveByIdOrThrow: jest.fn().mockResolvedValue(plan),
    };
    sepayService = {
      getConfig: jest.fn().mockResolvedValue({
        bankAccountNumber: '0123456789',
        bankName: 'Vietcombank',
      }),
      buildVietQrUrl: jest.fn().mockReturnValue('https://vietqr.app/fake'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prisma },
        { provide: SepayService, useValue: sepayService },
        {
          provide: SubscriptionPlansService,
          useValue: subscriptionPlansService,
        },
        { provide: UserActivityService, useValue: { log: jest.fn() } },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(SubscriptionService);
  });

  it('user đã có membership ACTIVE -> BadRequestException, KHÔNG đụng tới plan/order', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue({
      id: 'membership-1',
      plan: { totalDownloadLimit: null, dailyDownloadLimit: null },
    });

    await expect(service.createOrder('user-1', 'plan-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(
      subscriptionPlansService.findActiveByIdOrThrow,
    ).not.toHaveBeenCalled();
    expect(prisma.subscriptionOrder.create).not.toHaveBeenCalled();
  });

  it('user KHÔNG có membership ACTIVE -> tạo đơn bình thường', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(null);

    const result = await service.createOrder('user-1', 'plan-1');

    expect(result.order.code).toBe('SUB123456');
    expect(prisma.subscriptionOrder.create).toHaveBeenCalled();
  });
});

describe('SubscriptionService.revokeMembership — Admin thu hồi trước hạn', () => {
  let service: SubscriptionService;
  let prisma: {
    subscriptionMembership: Record<string, jest.Mock>;
    role: Record<string, jest.Mock>;
    userRole: Record<string, jest.Mock>;
  };
  let auditLog: { log: jest.Mock };

  const activeMembership = {
    id: 'membership-1',
    planId: 'plan-1',
    plan: { name: 'Gói 7 ngày' },
  };

  beforeEach(async () => {
    prisma = {
      subscriptionMembership: {
        findFirst: jest.fn().mockResolvedValue(activeMembership),
        update: jest.fn(),
      },
      role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-sub' }) },
      userRole: { deleteMany: jest.fn() },
    };
    auditLog = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prisma },
        { provide: SepayService, useValue: {} },
        { provide: SubscriptionPlansService, useValue: {} },
        { provide: UserActivityService, useValue: { log: jest.fn() } },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get(SubscriptionService);
  });

  it('user không có membership ACTIVE nào -> NotFoundException, không đụng gì khác', async () => {
    prisma.subscriptionMembership.findFirst.mockResolvedValue(null);

    await expect(service.revokeMembership('user-1', 'admin-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.subscriptionMembership.update).not.toHaveBeenCalled();
    expect(prisma.userRole.deleteMany).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('user có membership ACTIVE -> đánh dấu REVOKED, gỡ role, ghi AuditLog', async () => {
    await service.revokeMembership('user-1', 'admin-1');

    expect(prisma.subscriptionMembership.update).toHaveBeenCalledWith({
      where: { id: 'membership-1' },
      data: { status: 'REVOKED' },
    });
    expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', roleId: 'role-sub' },
    });
    expect(auditLog.log).toHaveBeenCalledWith(
      'admin-1',
      'SUBSCRIPTION_REVOKED',
      expect.objectContaining({ targetType: 'user', targetId: 'user-1' }),
    );
  });

  it('role "subscription" chưa tồn tại trong DB -> vẫn revoke membership, chỉ bỏ qua bước gỡ role', async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    await service.revokeMembership('user-1', 'admin-1');

    expect(prisma.subscriptionMembership.update).toHaveBeenCalled();
    expect(prisma.userRole.deleteMany).not.toHaveBeenCalled();
  });
});
