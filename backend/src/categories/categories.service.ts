import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildUniqueSlug } from '../common/slugify';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  list() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, parentId: true },
    });
  }

  async create(dto: CreateCategoryDto) {
    if (dto.parentId) await this.assertParentExists(dto.parentId);

    const slug = dto.slug
      ? dto.slug
      : await buildUniqueSlug(dto.name, (candidate) =>
          this.slugTaken(candidate),
        );

    const created = await this.prisma.category.create({
      data: { name: dto.name, slug, parentId: dto.parentId ?? null },
      select: { id: true, name: true, slug: true, parentId: true },
    });
    await this.cache.invalidatePrefix('categories');
    return created;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.getOrThrow(id);
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('Danh mục không thể là cha của chính nó');
      }
      await this.assertParentExists(dto.parentId);
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      },
      select: { id: true, name: true, slug: true, parentId: true },
    });
    await this.cache.invalidatePrefix('categories');
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.prisma.category.delete({ where: { id } });
    await this.cache.invalidatePrefix('categories');
  }

  private async getOrThrow(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Không tìm thấy danh mục');
    return category;
  }

  private async assertParentExists(parentId: string): Promise<void> {
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
    });
    if (!parent) throw new BadRequestException('Danh mục cha không tồn tại');
  }

  private async slugTaken(slug: string): Promise<boolean> {
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    return existing !== null;
  }
}
