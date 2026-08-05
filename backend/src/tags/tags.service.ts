import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildUniqueSlug } from '../common/slugify';
import { CacheService } from '../cache/cache.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

const tagSelect = {
  id: true,
  name: true,
  slug: true,
} as const;

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  list() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      select: tagSelect,
    });
  }

  async create(dto: CreateTagDto) {
    const slug = dto.slug
      ? dto.slug
      : await buildUniqueSlug(dto.name, (candidate) =>
          this.slugTaken(candidate),
        );

    const created = await this.prisma.tag.create({
      data: { name: dto.name, slug },
      select: tagSelect,
    });
    await this.cache.invalidatePrefix('tags');
    return created;
  }

  async update(id: string, dto: UpdateTagDto) {
    await this.getOrThrow(id);
    const updated = await this.prisma.tag.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
      },
      select: tagSelect,
    });
    await this.cache.invalidatePrefix('tags');
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.prisma.tag.delete({ where: { id } });
    await this.cache.invalidatePrefix('tags');
  }

  private async getOrThrow(id: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Không tìm thấy tag');
    return tag;
  }

  private async slugTaken(slug: string): Promise<boolean> {
    const existing = await this.prisma.tag.findUnique({ where: { slug } });
    return existing !== null;
  }
}
