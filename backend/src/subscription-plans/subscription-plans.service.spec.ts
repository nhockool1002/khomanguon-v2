import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionPlansService } from './subscription-plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

describe('SubscriptionPlansService', () => {
  let service: SubscriptionPlansService;
  let prisma: {
    subscriptionPlan: Record<string, jest.Mock>;
    subscriptionOrder: Record<string, jest.Mock>;
    subscriptionMembership: Record<string, jest.Mock>;
  };
  let cache: { invalidatePrefix: jest.Mock };

  beforeEach(async () => {
    prisma = {
      subscriptionPlan: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      subscriptionOrder: { count: jest.fn() },
      subscriptionMembership: { count: jest.fn() },
    };
    cache = { invalidatePrefix: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionPlansService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get(SubscriptionPlansService);
  });

  describe('findActiveByIdOrThrow', () => {
    it('gói không tồn tại -> NotFoundException', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue(null);
      await expect(
        service.findActiveByIdOrThrow('missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('gói tồn tại nhưng đã tắt (isActive=false) -> NotFoundException (không cho mua)', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'p1',
        isActive: false,
      });
      await expect(service.findActiveByIdOrThrow('p1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('gói đang bật -> trả về gói', async () => {
      const plan = { id: 'p1', isActive: true };
      prisma.subscriptionPlan.findUnique.mockResolvedValue(plan);
      await expect(service.findActiveByIdOrThrow('p1')).resolves.toBe(plan);
    });
  });

  describe('create', () => {
    it('totalDownloadLimit/dailyDownloadLimit không truyền -> lưu null (không giới hạn)', async () => {
      prisma.subscriptionPlan.create.mockResolvedValue({});
      await service.create({
        name: 'Gói test',
        durationDays: 7,
        priceVnd: 100000,
      });
      const call = prisma.subscriptionPlan.create.mock.calls[0] as [
        {
          data: {
            totalDownloadLimit: number | null;
            dailyDownloadLimit: number | null;
            isActive: boolean;
            order: number;
          };
        },
      ];
      expect(call[0].data.totalDownloadLimit).toBeNull();
      expect(call[0].data.dailyDownloadLimit).toBeNull();
      expect(call[0].data.isActive).toBe(true);
      expect(call[0].data.order).toBe(0);
      expect(cache.invalidatePrefix).toHaveBeenCalledWith('subscriptionPlans');
    });
  });

  describe('remove — chặn xoá gói đã có người dùng', () => {
    it('gói không tồn tại -> NotFoundException', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('gói đã có SubscriptionOrder tham chiếu -> chặn xoá', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.subscriptionOrder.count.mockResolvedValue(1);
      prisma.subscriptionMembership.count.mockResolvedValue(0);
      await expect(service.remove('p1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.subscriptionPlan.delete).not.toHaveBeenCalled();
    });

    it('gói đã có SubscriptionMembership tham chiếu -> chặn xoá', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.subscriptionOrder.count.mockResolvedValue(0);
      prisma.subscriptionMembership.count.mockResolvedValue(1);
      await expect(service.remove('p1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.subscriptionPlan.delete).not.toHaveBeenCalled();
    });

    it('gói chưa ai dùng -> xoá được, invalidate cache', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.subscriptionOrder.count.mockResolvedValue(0);
      prisma.subscriptionMembership.count.mockResolvedValue(0);
      await service.remove('p1');
      expect(prisma.subscriptionPlan.delete).toHaveBeenCalledWith({
        where: { id: 'p1' },
      });
      expect(cache.invalidatePrefix).toHaveBeenCalledWith('subscriptionPlans');
    });
  });
});
