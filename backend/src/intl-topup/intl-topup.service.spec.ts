import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IntlTopupStatus, WalletTxType } from '@prisma/client';
import { IntlTopupService } from './intl-topup.service';
import { IntlTopupInvoiceService } from './intl-topup-invoice.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { WalletGateway } from '../realtime/wallet.gateway';
import { SepayService } from '../sepay/sepay.service';

describe('IntlTopupService — nạp quốc tế Buy Me a Coffee (đối soát tay)', () => {
  let service: IntlTopupService;
  let prisma: {
    siteSetting: Record<string, jest.Mock>;
    intlTopupPackage: Record<string, jest.Mock>;
    intlTopupOrder: Record<string, jest.Mock>;
    auditLog: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let tx: {
    intlTopupOrder: Record<string, jest.Mock>;
    wallet: Record<string, jest.Mock>;
    walletTransaction: Record<string, jest.Mock>;
    auditLog: Record<string, jest.Mock>;
  };
  let mail: {
    sendIntlTopupMail: jest.Mock;
    getNotifyEmail: jest.Mock;
  };
  let walletGateway: { emitWalletUpdated: jest.Mock };

  const user = {
    id: 'user-a',
    displayName: 'Theara',
    email: 'theara@test.local',
  };
  const pendingOrder = {
    id: 'order-1',
    code: 'KMN-7F3K2Q',
    userId: 'user-a',
    amountUsd: 10,
    amountP: 2700,
    status: IntlTopupStatus.PENDING,
    expiresAt: new Date(Date.now() + 3600_000),
    termsAcceptedAt: new Date('2026-09-30T08:00:00Z'),
    termsIp: '1.2.3.4',
    payerEmail: 'bmc@test.local',
    user,
  };

  beforeEach(async () => {
    tx = {
      intlTopupOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      },
      wallet: {
        upsert: jest.fn().mockResolvedValue({ id: 'wallet-a', balance: 100 }),
        update: jest.fn(),
      },
      walletTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'wtx-1' }),
      },
      auditLog: { create: jest.fn() },
    };
    prisma = {
      siteSetting: { findUnique: jest.fn().mockResolvedValue(null) },
      intlTopupPackage: { findUnique: jest.fn() },
      intlTopupOrder: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }: { data: object }) => ({
          id: 'order-new',
          ...data,
        })),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'order-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
    };
    mail = {
      sendIntlTopupMail: jest.fn().mockResolvedValue(undefined),
      getNotifyEmail: jest.fn().mockResolvedValue('admin@test.local'),
    };
    walletGateway = { emitWalletUpdated: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntlTopupService,
        IntlTopupInvoiceService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
        { provide: WalletGateway, useValue: walletGateway },
        {
          provide: SepayService,
          useValue: {
            getTopupPresets: jest
              .fn()
              .mockResolvedValue({ baseRateVndPerP: 100, presets: [] }),
          },
        },
      ],
    }).compile();

    service = module.get(IntlTopupService);
  });

  describe('createOrder()', () => {
    it('gói không tồn tại / đã tắt -> BadRequest', async () => {
      prisma.intlTopupPackage.findUnique.mockResolvedValue({
        id: 'pkg',
        isActive: false,
      });
      await expect(
        service.createOrder('user-a', 'pkg', '1.2.3.4'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('đã có đủ số yêu cầu đang mở -> BadRequest, không tạo', async () => {
      prisma.intlTopupPackage.findUnique.mockResolvedValue({
        id: 'pkg',
        isActive: true,
        amountUsd: 10,
        amountP: 2700,
      });
      prisma.intlTopupOrder.count.mockResolvedValue(3);
      await expect(
        service.createOrder('user-a', 'pkg', '1.2.3.4'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.intlTopupOrder.create).not.toHaveBeenCalled();
    });

    it('tạo AWAITING_PAYMENT, mã KMN-, chụp lại USD/$P + bằng chứng điều khoản', async () => {
      prisma.intlTopupPackage.findUnique.mockResolvedValue({
        id: 'pkg',
        isActive: true,
        amountUsd: 10,
        amountP: 2700,
        bmcExtraUrl: null,
      });
      prisma.intlTopupOrder.findUnique.mockResolvedValue(null);
      const result = await service.createOrder('user-a', 'pkg', '1.2.3.4');
      const [[{ data }]] = prisma.intlTopupOrder.create.mock.calls as [
        [{ data: Record<string, unknown> }],
      ];
      expect(data.code).toMatch(/^KMN-[2-9A-HJKMNP-Z]{6}$/);
      expect(data).toMatchObject({
        userId: 'user-a',
        amountUsd: 10,
        amountP: 2700,
        termsIp: '1.2.3.4',
      });
      expect(data.termsAcceptedAt).toBeInstanceOf(Date);
      expect(result.bmcUrl).toBe('https://buymeacoffee.com/nhutnm');
    });
  });

  describe('claimPaid()', () => {
    it('đơn của người khác -> Forbidden', async () => {
      prisma.intlTopupOrder.findUnique.mockResolvedValue({
        ...pendingOrder,
        status: IntlTopupStatus.AWAITING_PAYMENT,
        userId: 'someone-else',
      });
      await expect(
        service.claimPaid('user-a', 'order-1', 'bmc@test.local'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('quá hạn -> chuyển EXPIRED + BadRequest, không gửi mail', async () => {
      prisma.intlTopupOrder.findUnique.mockResolvedValue({
        ...pendingOrder,
        status: IntlTopupStatus.AWAITING_PAYMENT,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.claimPaid('user-a', 'order-1', 'bmc@test.local'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.intlTopupOrder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: IntlTopupStatus.EXPIRED },
        }),
      );
      expect(mail.sendIntlTopupMail).not.toHaveBeenCalled();
    });

    it('hợp lệ -> PENDING + mail cho user và Admin', async () => {
      prisma.intlTopupOrder.findUnique.mockResolvedValue({
        ...pendingOrder,
        status: IntlTopupStatus.AWAITING_PAYMENT,
      });
      await service.claimPaid('user-a', 'order-1', ' BMC@Test.local ');
      expect(prisma.intlTopupOrder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1', status: IntlTopupStatus.AWAITING_PAYMENT },
          data: expect.objectContaining({
            status: IntlTopupStatus.PENDING,
            payerEmail: 'bmc@test.local',
          }) as unknown,
        }),
      );
      await new Promise((r) => setImmediate(r));
      const kinds = mail.sendIntlTopupMail.mock.calls.map(
        (c: unknown[]) => [c[0], c[2]] as const,
      );
      expect(kinds).toEqual(
        expect.arrayContaining([
          ['intlTopupPendingUser', ['theara@test.local']],
          ['intlTopupPendingAdmin', ['admin@test.local']],
        ]),
      );
    });
  });

  describe('approve()', () => {
    const dto = {
      receivedUsd: 10,
      creditedP: 2700,
      bmcTransactionRef: 'BMC-123456',
    };

    it('không còn PENDING (đã duyệt/2 Admin bấm cùng lúc) -> Conflict, KHÔNG cộng $P', async () => {
      prisma.intlTopupOrder.findUnique.mockResolvedValue(pendingOrder);
      tx.intlTopupOrder.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.approve('order-1', 'admin-1', dto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.wallet.upsert).not.toHaveBeenCalled();
      expect(tx.walletTransaction.create).not.toHaveBeenCalled();
    });

    it('cộng $P (INTL_TOPUP), ghi audit, gửi invoice PDF cho user + Admin', async () => {
      prisma.intlTopupOrder.findUnique.mockImplementation(
        ({ include }: { include?: unknown }) =>
          include
            ? {
                ...pendingOrder,
                status: IntlTopupStatus.APPROVED,
                invoiceNumber: 'INV-20260930-7F3K2Q',
                reviewedAt: new Date('2026-09-30T09:00:00Z'),
                receivedUsdCents: 1000,
                creditedP: 2700,
                bmcTransactionRef: 'BMC-123456',
              }
            : pendingOrder,
      );
      const result = await service.approve('order-1', 'admin-1', dto);

      const [[claim]] = tx.intlTopupOrder.updateMany.mock.calls as [
        [{ where: object; data: Record<string, unknown> }],
      ];
      expect(claim.where).toEqual({
        id: 'order-1',
        status: IntlTopupStatus.PENDING,
      });
      expect(claim.data).toMatchObject({
        status: IntlTopupStatus.APPROVED,
        receivedUsdCents: 1000,
        creditedP: 2700,
      });
      expect(claim.data.invoiceNumber).toMatch(/^INV-\d{8}-7F3K2Q$/);
      expect(tx.walletTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: WalletTxType.INTL_TOPUP,
          amount: 2700,
          balanceAfter: 2800,
          referenceId: 'order-1',
        }) as unknown,
      });
      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { userId: 'user-a' },
        data: { balance: 2800 },
      });
      expect(tx.auditLog.create).toHaveBeenCalled();
      expect(walletGateway.emitWalletUpdated).toHaveBeenCalledWith('user-a', {
        balance: 2800,
      });

      const [kind, , to, attachments] = mail.sendIntlTopupMail.mock
        .calls[0] as [
        string,
        unknown,
        string[],
        { filename: string; content: Buffer }[],
      ];
      expect(kind).toBe('intlTopupApproved');
      expect(to).toEqual(['theara@test.local', 'admin@test.local']);
      expect(attachments[0].filename).toBe('INV-20260930-7F3K2Q.pdf');
      expect(attachments[0].content.subarray(0, 4).toString()).toBe('%PDF');
      expect(result.mailError).toBeNull();
    });

    it('gửi mail lỗi sau khi đã cộng $P -> không throw, trả mailError cho Admin', async () => {
      prisma.intlTopupOrder.findUnique.mockImplementation(
        ({ include }: { include?: unknown }) =>
          include
            ? {
                ...pendingOrder,
                status: IntlTopupStatus.APPROVED,
                invoiceNumber: 'INV-20260930-7F3K2Q',
                reviewedAt: new Date(),
                receivedUsdCents: 1000,
                creditedP: 2700,
              }
            : pendingOrder,
      );
      mail.sendIntlTopupMail.mockRejectedValue(new Error('SMTP down'));
      const result = await service.approve('order-1', 'admin-1', dto);
      expect(tx.walletTransaction.create).toHaveBeenCalled();
      expect(result.mailError).toBe('SMTP down');
    });
  });

  describe('reject()', () => {
    it('PENDING -> REJECTED kèm lý do, audit + mail user', async () => {
      prisma.intlTopupOrder.findUnique.mockResolvedValue(pendingOrder);
      await service.reject('order-1', 'admin-1', ' No payment found ');
      expect(prisma.intlTopupOrder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1', status: IntlTopupStatus.PENDING },
          data: expect.objectContaining({
            status: IntlTopupStatus.REJECTED,
            rejectReason: 'No payment found',
          }) as unknown,
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalled();
      await new Promise((r) => setImmediate(r));
      expect(mail.sendIntlTopupMail).toHaveBeenCalledWith(
        'intlTopupRejected',
        expect.objectContaining({ reason: 'No payment found' }),
        ['theara@test.local'],
      );
    });

    it('đã xử lý rồi -> Conflict', async () => {
      prisma.intlTopupOrder.findUnique.mockResolvedValue(pendingOrder);
      prisma.intlTopupOrder.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.reject('order-1', 'admin-1', 'No payment'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('getInvoice()', () => {
    it('user khác (không phải Admin) -> Forbidden', async () => {
      prisma.intlTopupOrder.findUnique.mockResolvedValue({ userId: 'user-a' });
      await expect(
        service.getInvoice('order-1', 'user-b', false),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
