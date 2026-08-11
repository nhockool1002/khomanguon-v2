import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DownloadLinksService } from './download-links.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2ClientService } from '../storage/r2-client.service';
import { WalletGateway } from '../realtime/wallet.gateway';
import { MailService } from '../mail/mail.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { SubscriptionService } from '../subscriptions/subscription.service';

describe('DownloadLinksService — unlock ($P) và unlockSmart (Subscription trước, $P sau)', () => {
  let service: DownloadLinksService;
  let prisma: {
    downloadLink: Record<string, jest.Mock>;
    post: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let subscriptionService: { checkFreeDownloadEligibility: jest.Mock };
  let txCalls: {
    wallet: Record<string, jest.Mock>;
    walletTransaction: Record<string, jest.Mock>;
    downloadGrant: Record<string, jest.Mock>;
    downloadEvent: Record<string, jest.Mock>;
  };

  const freeLink = {
    id: 'link-free',
    postId: 'post-1',
    priceP: 0,
    storageProviderId: 'sp-1',
    objectKey: 'posts/2026/08/11/file.zip',
    label: 'file.zip',
  };
  const paidLink = { ...freeLink, id: 'link-paid', priceP: 50 };

  beforeEach(async () => {
    txCalls = {
      wallet: {
        upsert: jest.fn().mockResolvedValue({ id: 'wallet-1', balance: 100 }),
        update: jest.fn(),
      },
      walletTransaction: { create: jest.fn() },
      downloadGrant: { create: jest.fn() },
      downloadEvent: { create: jest.fn() },
    };

    prisma = {
      downloadLink: { findUnique: jest.fn() },
      post: {
        findUnique: jest.fn().mockResolvedValue({ title: 'Bài viết test' }),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ displayName: 'User', email: 'u@test.local' }),
      },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(txCalls)),
    };
    subscriptionService = { checkFreeDownloadEligibility: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DownloadLinksService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: R2ClientService,
          useValue: {
            getPresignedDownloadUrl: jest
              .fn()
              .mockResolvedValue('https://signed.url/file'),
          },
        },
        { provide: WalletGateway, useValue: { emitWalletUpdated: jest.fn() } },
        {
          provide: MailService,
          useValue: { sendDownloadUnlockNotification: jest.fn() },
        },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
        { provide: SubscriptionService, useValue: subscriptionService },
      ],
    }).compile();

    service = module.get(DownloadLinksService);
  });

  describe('unlock() — luồng $P hiện có (KHÔNG được đổi hành vi)', () => {
    it('link miễn phí (priceP=0) -> không đụng Wallet, vẫn ghi DownloadGrant + DownloadEvent', async () => {
      prisma.downloadLink.findUnique.mockResolvedValue(freeLink);
      const result = await service.unlock('user-1', 'link-free', '1.2.3.4');
      expect(result).toEqual({ url: 'https://signed.url/file' });
      expect(txCalls.wallet.upsert).not.toHaveBeenCalled();
      expect(txCalls.walletTransaction.create).not.toHaveBeenCalled();
      expect(txCalls.downloadGrant.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', downloadLinkId: 'link-free' },
      });
      expect(txCalls.downloadEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          downloadLinkId: 'link-free',
          ipAddress: '1.2.3.4',
        },
      });
    });

    it('link trả phí, đủ số dư -> trừ đúng priceP, ghi WalletTransaction âm', async () => {
      prisma.downloadLink.findUnique.mockResolvedValue(paidLink);
      txCalls.wallet.upsert.mockResolvedValue({ id: 'wallet-1', balance: 100 });
      const result = await service.unlock('user-1', 'link-paid', '1.2.3.4');
      expect(result).toEqual({ url: 'https://signed.url/file' });
      expect(txCalls.wallet.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { balance: 50 },
      });
      const txCall = txCalls.walletTransaction.create.mock.calls[0] as [
        { data: { amount: number; balanceAfter: number } },
      ];
      expect(txCall[0].data.amount).toBe(-50);
      expect(txCall[0].data.balanceAfter).toBe(50);
    });

    it('link trả phí, KHÔNG đủ số dư -> HttpException 402, không trừ tiền', async () => {
      prisma.downloadLink.findUnique.mockResolvedValue(paidLink);
      txCalls.wallet.upsert.mockResolvedValue({ id: 'wallet-1', balance: 10 }); // < priceP=50
      await expect(
        service.unlock('user-1', 'link-paid', '1.2.3.4'),
      ).rejects.toBeInstanceOf(HttpException);
      expect(txCalls.wallet.update).not.toHaveBeenCalled();
      expect(txCalls.walletTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe('unlockSmart() — quyết định Subscription (miễn phí) hay $P (unlock() cũ)', () => {
    it('user CÓ quota Subscription khả dụng -> tải MIỄN PHÍ, không đụng Wallet, DownloadEvent gắn subscriptionMembershipId', async () => {
      prisma.downloadLink.findUnique.mockResolvedValue(paidLink); // dù link có giá, Subscription vẫn free
      subscriptionService.checkFreeDownloadEligibility.mockResolvedValue({
        eligible: true,
        membershipId: 'membership-1',
      });

      const result = await service.unlockSmart(
        'user-1',
        'link-paid',
        '1.2.3.4',
      );

      expect(result).toEqual({ url: 'https://signed.url/file' });
      expect(txCalls.wallet.upsert).not.toHaveBeenCalled();
      expect(txCalls.walletTransaction.create).not.toHaveBeenCalled();
      expect(txCalls.downloadEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          downloadLinkId: 'link-paid',
          ipAddress: '1.2.3.4',
          subscriptionMembershipId: 'membership-1',
        },
      });
      expect(txCalls.downloadGrant.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', downloadLinkId: 'link-paid' },
      });
    });

    it('user KHÔNG có Subscription (hoặc hết quota) -> rơi về unlock() $P bình thường, đủ tiền thì trừ $P', async () => {
      prisma.downloadLink.findUnique.mockResolvedValue(paidLink);
      subscriptionService.checkFreeDownloadEligibility.mockResolvedValue({
        eligible: false,
      });
      txCalls.wallet.upsert.mockResolvedValue({ id: 'wallet-1', balance: 100 });

      const result = await service.unlockSmart(
        'user-1',
        'link-paid',
        '1.2.3.4',
      );

      expect(result).toEqual({ url: 'https://signed.url/file' });
      expect(txCalls.wallet.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { balance: 50 },
      });
      // DownloadEvent của nhánh $P KHÔNG có subscriptionMembershipId.
      expect(txCalls.downloadEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          downloadLinkId: 'link-paid',
          ipAddress: '1.2.3.4',
        },
      });
    });

    it('user hết quota Subscription VÀ không đủ $P -> vẫn báo lỗi 402 như luồng thường (không có ngoại lệ ẩn)', async () => {
      prisma.downloadLink.findUnique.mockResolvedValue(paidLink);
      subscriptionService.checkFreeDownloadEligibility.mockResolvedValue({
        eligible: false,
      });
      txCalls.wallet.upsert.mockResolvedValue({ id: 'wallet-1', balance: 0 });

      await expect(
        service.unlockSmart('user-1', 'link-paid', '1.2.3.4'),
      ).rejects.toBeInstanceOf(HttpException);
    });
  });
});
