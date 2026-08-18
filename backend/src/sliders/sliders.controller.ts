import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SlidersService } from './sliders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CreateSliderDto } from './dto/create-slider.dto';
import { UpdateSliderDto } from './dto/update-slider.dto';
import { Cacheable } from '../cache/cacheable.decorator';
import { HttpCacheInterceptor } from '../cache/http-cache.interceptor';

// PermissionsGuard chỉ đọc metadata gắn trực tiếp trên từng handler — @Permissions phải khai báo
// lại ở mỗi method, không đặt 1 lần ở class (cùng gotcha đã ghi ở widgets.controller.ts).
@Controller('sliders')
export class SlidersController {
  constructor(private readonly slidersService: SlidersService) {}

  // Public — trang chủ/trang bài viết render carousel, và modal "Chèn Slider" trong trình soạn bài
  // viết cũng gọi endpoint này để liệt kê (dữ liệu không nhạy cảm, không cần list riêng cho admin).
  @UseInterceptors(HttpCacheInterceptor)
  @Cacheable('sliders', 300)
  @Get()
  list() {
    return this.slidersService.list();
  }

  @UseInterceptors(HttpCacheInterceptor)
  @Cacheable('sliders', 300)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.slidersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SLIDER_MANAGE)
  @Post()
  create(@Body() dto: CreateSliderDto) {
    return this.slidersService.create(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SLIDER_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSliderDto) {
    return this.slidersService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SLIDER_MANAGE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.slidersService.remove(id);
  }
}
