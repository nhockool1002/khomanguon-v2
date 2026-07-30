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
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(PERMISSIONS.ROLE_MANAGE)
@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  list() {
    return this.rolesService.listRoles();
  }

  @Get('permissions')
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Post('roles')
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(dto);
  }

  @Patch('roles/:id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  remove(@Param('id') id: string) {
    return this.rolesService.deleteRole(id);
  }
}
