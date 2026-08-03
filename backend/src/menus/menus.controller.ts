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
import { MenusService } from './menus.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { ReorderMenuDto } from './dto/reorder-menu.dto';
import { Cacheable } from '../cache/cacheable.decorator';
import { HttpCacheInterceptor } from '../cache/http-cache.interceptor';

@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  // Public — navbar site đọc cây menu để render (UC16).
  @UseInterceptors(HttpCacheInterceptor)
  @Cacheable('menus', 300)
  @Get()
  list() {
    return this.menusService.list();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.MENU_MANAGE)
  @Post()
  create(@Body() dto: CreateMenuDto) {
    return this.menusService.create(dto);
  }

  // Khai báo trước ":id" để không bị match nhầm thành id="reorder".
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.MENU_MANAGE)
  @Patch('reorder')
  reorder(@Body() dto: ReorderMenuDto) {
    return this.menusService.reorder(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.MENU_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMenuDto) {
    return this.menusService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.MENU_MANAGE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.menusService.remove(id);
  }
}
