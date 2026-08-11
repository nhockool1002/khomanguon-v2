import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';

@Injectable()
export class SubscriptionPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // Public — hiện dạng "card" ở trang nạp tiền, chỉ gói đang bật.
  async listPublic() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  async listAdmin() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { order: 'asc' },
    });
  }

  async findActiveByIdOrThrow(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!plan || !plan.isActive) {
      throw new NotFoundException(
        'Không tìm thấy gói Subscription đang mở bán',
      );
    }
    return plan;
  }

  async create(dto: CreateSubscriptionPlanDto) {
    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        durationDays: dto.durationDays,
        priceVnd: dto.priceVnd,
        totalDownloadLimit: dto.totalDownloadLimit ?? null,
        dailyDownloadLimit: dto.dailyDownloadLimit ?? null,
        isActive: dto.isActive ?? true,
        order: dto.order ?? 0,
      },
    });
    await this.cache.invalidatePrefix('subscriptionPlans');
    return plan;
  }

  async update(id: string, dto: UpdateSubscriptionPlanDto) {
    await this.getOrThrow(id);
    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.durationDays !== undefined && {
          durationDays: dto.durationDays,
        }),
        ...(dto.priceVnd !== undefined && { priceVnd: dto.priceVnd }),
        ...(dto.totalDownloadLimit !== undefined && {
          totalDownloadLimit: dto.totalDownloadLimit,
        }),
        ...(dto.dailyDownloadLimit !== undefined && {
          dailyDownloadLimit: dto.dailyDownloadLimit,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });
    await this.cache.invalidatePrefix('subscriptionPlans');
    return plan;
  }

  // Không cho xoá gói đã có người mua/đang dùng (FK Restrict sẽ chặn ở tầng DB, nhưng chặn sớm ở
  // đây để trả lỗi rõ ràng thay vì lỗi SQL chung chung) — đề nghị tắt "Đang bật" thay vì xoá, vẫn
  // giữ được lịch sử SubscriptionOrder/SubscriptionMembership cũ tham chiếu tới gói này.
  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    const [orderCount, membershipCount] = await Promise.all([
      this.prisma.subscriptionOrder.count({ where: { planId: id } }),
      this.prisma.subscriptionMembership.count({ where: { planId: id } }),
    ]);
    if (orderCount > 0 || membershipCount > 0) {
      throw new BadRequestException(
        'Gói này đã có người đăng ký/mua — không thể xoá, hãy tắt "Đang bật" thay vì xoá.',
      );
    }
    await this.prisma.subscriptionPlan.delete({ where: { id } });
    await this.cache.invalidatePrefix('subscriptionPlans');
  }

  private async getOrThrow(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!plan) throw new NotFoundException('Không tìm thấy gói Subscription');
    return plan;
  }
}
