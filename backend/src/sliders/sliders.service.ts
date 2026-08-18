import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSliderDto } from './dto/create-slider.dto';
import { UpdateSliderDto } from './dto/update-slider.dto';
import { SlideDto } from './dto/slide.dto';
import { CacheService } from '../cache/cache.service';

const sliderSelect = {
  id: true,
  title: true,
  bulletStyle: true,
  transitionStyle: true,
  autoplay: true,
  autoplayDelayMs: true,
  loop: true,
  createdAt: true,
  updatedAt: true,
  slides: {
    orderBy: { order: 'asc' },
    select: {
      id: true,
      imageUrl: true,
      linkUrl: true,
      caption: true,
      order: true,
    },
  },
} satisfies Prisma.SliderSelect;

@Injectable()
export class SlidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // Public — trang chủ/trang bài viết đọc để dựng carousel, cùng modal chọn Slider trong trình
  // soạn bài viết cũng gọi endpoint này (không cần list riêng cho admin, dữ liệu không nhạy cảm).
  async list() {
    return this.prisma.slider.findMany({
      orderBy: { createdAt: 'desc' },
      select: sliderSelect,
    });
  }

  async findOne(id: string) {
    const slider = await this.prisma.slider.findUnique({
      where: { id },
      select: sliderSelect,
    });
    if (!slider) throw new NotFoundException('Không tìm thấy slider');
    return slider;
  }

  async create(dto: CreateSliderDto) {
    const slider = await this.prisma.slider.create({
      data: {
        title: dto.title,
        bulletStyle: dto.bulletStyle,
        transitionStyle: dto.transitionStyle,
        autoplay: dto.autoplay,
        autoplayDelayMs: dto.autoplayDelayMs,
        loop: dto.loop,
        slides: { create: dto.slides.map(toSlideCreateInput) },
      },
    });
    await this.cache.invalidatePrefix('sliders');
    return this.findOne(slider.id);
  }

  async update(id: string, dto: UpdateSliderDto) {
    await this.assertExists(id);

    await this.prisma.slider.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.bulletStyle !== undefined && { bulletStyle: dto.bulletStyle }),
        ...(dto.transitionStyle !== undefined && {
          transitionStyle: dto.transitionStyle,
        }),
        ...(dto.autoplay !== undefined && { autoplay: dto.autoplay }),
        ...(dto.autoplayDelayMs !== undefined && {
          autoplayDelayMs: dto.autoplayDelayMs,
        }),
        ...(dto.loop !== undefined && { loop: dto.loop }),
      },
    });
    if (dto.slides !== undefined) await this.syncSlides(id, dto.slides);
    await this.cache.invalidatePrefix('sliders');
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.assertExists(id);
    await this.prisma.slider.delete({ where: { id } });
    await this.cache.invalidatePrefix('sliders');
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.slider.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Không tìm thấy slider');
  }

  // Thay thế toàn bộ slides trong 1 transaction — cùng cách tiếp cận với WidgetsService.syncRoles(),
  // đơn giản hơn nhiều so với diff từng item vì slides không có FK ngoài trỏ vào (khác WidgetRole
  // là bảng join, SliderSlide có thể xoá/tạo tự do theo sliderId).
  private async syncSlides(
    sliderId: string,
    slides: SlideDto[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.sliderSlide.deleteMany({ where: { sliderId } }),
      ...slides.map((slide) =>
        this.prisma.sliderSlide.create({
          data: { sliderId, ...toSlideCreateInput(slide) },
        }),
      ),
    ]);
  }
}

function toSlideCreateInput(slide: SlideDto) {
  return {
    imageUrl: slide.imageUrl,
    linkUrl: slide.linkUrl,
    caption: slide.caption,
    order: slide.order,
  };
}
