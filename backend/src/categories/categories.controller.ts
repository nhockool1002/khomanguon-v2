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
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderCategoryDto } from './dto/reorder-category.dto';
import { Cacheable } from '../cache/cacheable.decorator';
import { HttpCacheInterceptor } from '../cache/http-cache.interceptor';

// Chưa có quyền "category.manage" riêng trong ma trận RBAC (mục 06 tài liệu thiết kế) —
// tái dùng post.publish vì đây cũng là thao tác cấu trúc nội dung chỉ Admin/Super Mod được làm.
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @UseInterceptors(HttpCacheInterceptor)
  @Cacheable('categories', 300)
  @Get()
  list() {
    return this.categoriesService.list();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.POST_PUBLISH)
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  // Khai báo trước ":id" để không bị match nhầm thành id="reorder".
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.POST_PUBLISH)
  @Patch('reorder')
  reorder(@Body() dto: ReorderCategoryDto) {
    return this.categoriesService.reorder(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.POST_PUBLISH)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.POST_PUBLISH)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
