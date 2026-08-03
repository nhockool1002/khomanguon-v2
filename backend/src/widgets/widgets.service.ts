import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { ReorderWidgetDto } from './dto/reorder-widget.dto';
import { CacheService } from '../cache/cache.service';

const widgetSelect = {
  id: true,
  type: true,
  title: true,
  area: true,
  order: true,
  isActive: true,
  config: true,
  visibleTo: { select: { role: { select: { slug: true } } } },
} satisfies Prisma.WidgetSelect;

type WidgetRow = Prisma.WidgetGetPayload<{ select: typeof widgetSelect }>;

function toWidgetDto(widget: WidgetRow) {
  const { visibleTo, ...rest } = widget;
  return { ...rest, roleSlugs: visibleTo.map((v) => v.role.slug) };
}

@Injectable()
export class WidgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // Public — trang chủ/trang bài viết đọc để render sidebar (FE tự lọc area/isActive/công khai,
  // giống cách menus đang làm).
  async list() {
    const rows = await this.prisma.widget.findMany({
      orderBy: { order: 'asc' },
      select: widgetSelect,
    });
    return rows.map(toWidgetDto);
  }

  async create(dto: CreateWidgetDto) {
    const maxOrder = await this.prisma.widget.aggregate({
      _max: { order: true },
    });

    const widget = await this.prisma.widget.create({
      data: {
        type: dto.type,
        title: dto.title,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });
    if (dto.roleSlugs) await this.syncRoles(widget.id, dto.roleSlugs);
    await this.cache.invalidatePrefix('widgets');
    return this.getOne(widget.id);
  }

  async update(id: string, dto: UpdateWidgetDto) {
    await this.assertExists(id);

    await this.prisma.widget.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.config !== undefined && {
          config: dto.config as Prisma.InputJsonValue,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    if (dto.roleSlugs !== undefined) await this.syncRoles(id, dto.roleSlugs);
    await this.cache.invalidatePrefix('widgets');
    return this.getOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.assertExists(id);
    await this.prisma.widget.delete({ where: { id } });
    await this.cache.invalidatePrefix('widgets');
  }

  // Gọi sau mỗi lần kéo-thả — cập nhật order hàng loạt trong 1 transaction.
  async reorder(dto: ReorderWidgetDto): Promise<void> {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.widget.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );
    await this.cache.invalidatePrefix('widgets');
  }

  private async getOne(id: string) {
    const widget = await this.prisma.widget.findUnique({
      where: { id },
      select: widgetSelect,
    });
    if (!widget) throw new NotFoundException('Không tìm thấy widget');
    return toWidgetDto(widget);
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.widget.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Không tìm thấy widget');
  }

  private async syncRoles(
    widgetId: string,
    roleSlugs: string[],
  ): Promise<void> {
    const roles = roleSlugs.length
      ? await this.prisma.role.findMany({ where: { slug: { in: roleSlugs } } })
      : [];
    await this.prisma.$transaction([
      this.prisma.widgetRole.deleteMany({ where: { widgetId } }),
      ...roles.map((role) =>
        this.prisma.widgetRole.create({ data: { widgetId, roleId: role.id } }),
      ),
    ]);
  }
}
