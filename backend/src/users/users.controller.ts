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
import { UserActivityType } from '@prisma/client';
import { UsersService } from './users.service';
import type { UserSortBy, SortDir } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserActivityService } from '../user-activity/user-activity.service';
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
  constructor(
    private readonly usersService: UsersService,
    private readonly userActivity: UserActivityService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.usersService.getProfile(user.id);
  }

  // Tab "Hoạt động" công khai — bất kỳ ai cũng xem được (kể cả khách chưa đăng nhập), giống
  // getPublicProfile() bên dưới. Đặt TRƯỚC ':id/public-profile' không quan trọng (khác path suffix).
  @Get(':id/activity')
  listActivity(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.listActivity(
      id,
      Number(page) || 1,
      Number(limit) || 20,
    );
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
  // OptionalJwtAuthGuard: biết ai đang xem nếu đăng nhập, để ghi UserActivity VISIT_PROFILE cho
  // NGƯỜI XEM (không log khi tự xem chính mình).
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/public-profile')
  async getPublicProfile(
    @Param('id') id: string,
    @CurrentUser() viewer: AuthUser | undefined,
  ) {
    const profile = await this.usersService.getPublicProfile(id);
    if (viewer && viewer.id !== id) {
      void this.userActivity.log(viewer.id, UserActivityType.VISIT_PROFILE, {
        profileUserId: id,
        profileDisplayName: profile.displayName,
      });
    }
    return profile;
  }

  // Dữ liệu cho card xem nhanh khi hover tên user (StyledUserName) — CÙNG dữ liệu với
  // public-profile nhưng KHÔNG ghi UserActivity VISIT_PROFILE. Hover xảy ra ở khắp nơi (danh sách
  // bình luận, byline bài viết...) nên nếu dùng chung endpoint public-profile sẽ ghi log "ghé thăm"
  // giả hàng loạt mỗi lần rê chuột qua tên, làm sai lệch ý nghĩa thật của VISIT_PROFILE (chỉ nên
  // tính khi thật sự điều hướng sang trang hồ sơ).
  @Get(':id/profile-preview')
  getProfilePreview(@Param('id') id: string) {
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
