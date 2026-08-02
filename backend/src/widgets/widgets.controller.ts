import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WidgetsService } from './widgets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { ReorderWidgetDto } from './dto/reorder-widget.dto';

// PermissionsGuard chỉ đọc metadata gắn trực tiếp trên từng handler — @Permissions phải khai báo
// lại ở mỗi method, không đặt 1 lần ở class (xem storage-providers.controller.ts).
@Controller('widgets')
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  // Public — trang chủ/trang bài viết đọc để render sidebar (UC tương đương UC16 menu).
  @Get()
  list() {
    return this.widgetsService.list();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.WIDGET_MANAGE)
  @Post()
  create(@Body() dto: CreateWidgetDto) {
    return this.widgetsService.create(dto);
  }

  // Khai báo trước ":id" để không bị match nhầm thành id="reorder".
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.WIDGET_MANAGE)
  @Patch('reorder')
  reorder(@Body() dto: ReorderWidgetDto) {
    return this.widgetsService.reorder(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.WIDGET_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWidgetDto) {
    return this.widgetsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.WIDGET_MANAGE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.widgetsService.remove(id);
  }
}
