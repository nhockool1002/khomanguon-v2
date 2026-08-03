import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { ReorderMenuDto } from './dto/reorder-menu.dto';
import { CacheService } from '../cache/cache.service';

const menuSelect = {
  id: true,
  label: true,
  url: true,
  icon: true,
  order: true,
  openInNewTab: true,
  parentId: true,
  visibleTo: { select: { role: { select: { slug: true } } } },
} satisfies Prisma.MenuSelect;

type MenuRow = Prisma.MenuGetPayload<{ select: typeof menuSelect }>;

function toMenuDto(menu: MenuRow) {
  const { visibleTo, ...rest } = menu;
  return { ...rest, roleSlugs: visibleTo.map((v) => v.role.slug) };
}

@Injectable()
export class MenusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async list() {
    const rows = await this.prisma.menu.findMany({
      orderBy: [{ parentId: 'asc' }, { order: 'asc' }],
      select: menuSelect,
    });
    return rows.map(toMenuDto);
  }

  async create(dto: CreateMenuDto) {
    if (dto.parentId) await this.assertExists(dto.parentId);

    const maxOrder = await this.prisma.menu.aggregate({
      where: { parentId: dto.parentId ?? null },
      _max: { order: true },
    });

    const menu = await this.prisma.menu.create({
      data: {
        label: dto.label,
        url: dto.url,
        icon: dto.icon,
        openInNewTab: dto.openInNewTab ?? false,
        parentId: dto.parentId ?? null,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });
    if (dto.roleSlugs) await this.syncRoles(menu.id, dto.roleSlugs);
    await this.cache.invalidatePrefix('menus');
    return this.getOne(menu.id);
  }

  async update(id: string, dto: UpdateMenuDto) {
    await this.assertExists(id);
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('Menu không thể là cha của chính nó');
      }
      await this.assertExists(dto.parentId);
    }

    await this.prisma.menu.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.url !== undefined && { url: dto.url }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.openInNewTab !== undefined && {
          openInNewTab: dto.openInNewTab,
        }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      },
    });
    if (dto.roleSlugs !== undefined) await this.syncRoles(id, dto.roleSlugs);
    await this.cache.invalidatePrefix('menus');
    return this.getOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.assertExists(id);
    await this.prisma.menu.delete({ where: { id } });
    await this.cache.invalidatePrefix('menus');
  }

  // Gọi sau mỗi lần kéo-thả — cập nhật order/parentId hàng loạt trong 1 transaction.
  async reorder(dto: ReorderMenuDto): Promise<void> {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.menu.update({
          where: { id: item.id },
          data: { order: item.order, parentId: item.parentId ?? null },
        }),
      ),
    );
    await this.cache.invalidatePrefix('menus');
  }

  private async getOne(id: string) {
    const menu = await this.prisma.menu.findUnique({
      where: { id },
      select: menuSelect,
    });
    if (!menu) throw new NotFoundException('Không tìm thấy menu');
    return toMenuDto(menu);
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.menu.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Không tìm thấy menu');
  }

  private async syncRoles(menuId: string, roleSlugs: string[]): Promise<void> {
    const roles = roleSlugs.length
      ? await this.prisma.role.findMany({ where: { slug: { in: roleSlugs } } })
      : [];
    await this.prisma.$transaction([
      this.prisma.menuRole.deleteMany({ where: { menuId } }),
      ...roles.map((role) =>
        this.prisma.menuRole.create({ data: { menuId, roleId: role.id } }),
      ),
    ]);
  }
}
