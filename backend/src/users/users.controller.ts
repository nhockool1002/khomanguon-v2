import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import type { UserSortBy, SortDir } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateStyleRoleDto } from './dto/update-style-role.dto';
import { UpdateUserTitleDto } from './dto/update-user-title.dto';
import { CreateProfileMessageDto } from './dto/create-profile-message.dto';

interface AuthUser {
  id: string;
  email: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.usersService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.id, dto);
  }

  // User thuộc >1 role tự chọn role nào áp style tên hiển thị (comment, byline...) ở trang Tài khoản.
  @UseGuards(JwtAuthGuard)
  @Patch('me/style-role')
  updateStyleRole(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateStyleRoleDto,
  ) {
    return this.usersService.updateStyleRole(user.id, dto.roleSlug);
  }

  // Đổi Title cá nhân — giới hạn độ dài/HTML/tần suất theo role, xem users.service.ts updateTitle().
  @UseGuards(JwtAuthGuard)
  @Patch('me/title')
  updateTitle(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserTitleDto) {
    return this.usersService.updateTitle(user.id, dto.title);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.USER_MANAGE)
  @Get()
  list(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: UserSortBy,
    @Query('sortDir') sortDir?: SortDir,
  ) {
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    return this.usersService.list(skip, take, search, sortBy, sortDir);
  }

  // Admin bấm "Đặt lại mật khẩu" ở trang quản lý user — gửi mail chứa link đặt lại mật khẩu, không
  // tự đổi mật khẩu thay user (giữ đúng luồng bảo mật hiện có, chỉ admin không tự set mật khẩu mới).
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.USER_MANAGE)
  @Post(':id/send-reset-password')
  sendResetPassword(@Param('id') id: string) {
    return this.usersService.sendResetPasswordEmail(id);
  }

  // Gợi ý @mention trong bình luận + chọn user lọc widget Bình luận (UC tương đương) — bất kỳ user
  // đăng nhập nào cũng gọi được, không cần USER_MANAGE (chỉ trả field vốn đã public).
  @UseGuards(JwtAuthGuard)
  @Get('search')
  search(@Query('q') q = '', @Query('limit') limit = '8') {
    return this.usersService.search(q, Number(limit) || 8);
  }

  // Chặn user spam bình luận (UC08) — cũng dùng chung cho khoá tài khoản nói chung.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.USER_MANAGE)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.usersService.updateStatus(id, dto.status);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.USER_ASSIGN_ROLE)
  @Post(':id/roles')
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.usersService.assignRole(id, dto.roleSlug);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.USER_ASSIGN_ROLE)
  @Delete(':id/roles/:roleSlug')
  removeRole(@Param('id') id: string, @Param('roleSlug') roleSlug: string) {
    return this.usersService.removeRole(id, roleSlug);
  }

  // Trang profile công khai — bất kỳ ai cũng xem được, kể cả khách vãng lai chưa đăng nhập.
  @Get(':id/public-profile')
  getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }

  @Get(':id/messages')
  listMessages(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = Math.min(Number(limit) || 20, 50);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    return this.usersService.listProfileMessages(id, skip, take);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/messages')
  createMessage(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProfileMessageDto,
  ) {
    return this.usersService.createProfileMessage(id, user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/messages/:messageId')
  removeMessage(
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.removeProfileMessage(messageId, user.id);
  }
}
