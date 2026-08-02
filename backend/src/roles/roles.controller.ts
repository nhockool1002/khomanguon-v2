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
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { Permissions } from './decorators/permissions.decorator';
import { PERMISSIONS } from './permissions.constant';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

// UI ma trận quyền tick chọn theo module (UC17, wireframe #11).
// @Permissions phải khai báo lại ở TỪNG method — PermissionsGuard chỉ đọc metadata qua
// context.getHandler() (method-level), đặt ở class sẽ bị bỏ qua và guard cho qua mọi user đã đăng
// nhập (required=undefined -> return true). Đây là lỗi thật đã phát hiện khi rà lại controller này.
@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.ROLE_MANAGE)
  @Get('roles')
  list() {
    return this.rolesService.listRoles();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.ROLE_MANAGE)
  @Get('permissions')
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.ROLE_MANAGE)
  @Post('roles')
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.ROLE_MANAGE)
  @Patch('roles/:id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.updateRole(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.ROLE_MANAGE)
  @Delete('roles/:id')
  remove(@Param('id') id: string) {
    return this.rolesService.deleteRole(id);
  }
}
