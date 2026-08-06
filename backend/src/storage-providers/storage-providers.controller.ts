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
import { StorageProvidersService } from './storage-providers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateStorageProviderDto } from './dto/create-storage-provider.dto';
import { UpdateStorageProviderDto } from './dto/update-storage-provider.dto';

interface AuthUser {
  id: string;
  email: string;
}

// PermissionsGuard chỉ đọc metadata gắn TRỰC TIẾP trên từng handler (context.getHandler()), không
// gộp metadata ở class level — nên @Permissions phải khai báo lại ở mỗi method (giống CategoriesController),
// không thể đặt 1 lần dùng chung ở class như @UseGuards.
@Controller('storage-providers')
export class StorageProvidersController {
  constructor(
    private readonly storageProvidersService: StorageProvidersService,
  ) {}

  // Chỉ trả field không nhạy cảm (xem publicSelect trong service) — cho phép ai quản lý được link tải
  // của bài viết (DOWNLOAD_MANAGE_LINKS) cũng thấy để chọn provider, không cần full quyền storage key.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)
  @Get()
  list() {
    return this.storageProvidersService.list();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_STORAGE_KEYS)
  @Post()
  create(@Body() dto: CreateStorageProviderDto) {
    return this.storageProvidersService.create(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_STORAGE_KEYS)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStorageProviderDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.storageProvidersService.update(id, dto, actor.id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_STORAGE_KEYS)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.storageProvidersService.remove(id);
  }
}
