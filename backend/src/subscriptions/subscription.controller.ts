import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Body,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesService } from '../roles/roles.service';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CreateSubscriptionOrderDto } from './dto/create-subscription-order.dto';

interface AuthUser {
  id: string;
  email: string;
}

@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    // RolesModule là @Global() — không cần khai báo trong SubscriptionModule.imports.
    private readonly rolesService: RolesService,
  ) {}

  // Trạng thái gói hiện tại của chính mình (null nếu không có kỳ nào đang hiệu lực) — trang nạp
  // tiền dùng để hiện "Bạn đang dùng gói X, còn Y ngày, đã tải Z/N lượt".
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMyStatus(@CurrentUser() user: AuthUser) {
    return this.subscriptionService.getMyStatus(user.id);
  }

  // Xem thông tin Subscription của MỘT USER BẤT KỲ — dùng cho tab "Subscription" ở trang Hồ sơ
  // (profile-page.tsx). Riêng tư theo đúng yêu cầu: chính chủ luôn xem được (không cần permission
  // gì thêm), người khác phải có quyền subscription.view_any (Admin có mặc định qua
  // ALL_PERMISSION_KEYS, Super Moderator có mặc định — xem permissions.constant.ts, role khác phải
  // được cấp riêng qua trang Phân quyền). KHÔNG dùng @Permissions()/PermissionsGuard chuẩn vì đó chỉ
  // kiểm tra permission đơn thuần, không có nhánh "hoặc là chính mình".
  @UseGuards(JwtAuthGuard)
  @Get('users/:userId')
  async getUserStatus(
    @CurrentUser() viewer: AuthUser,
    @Param('userId') userId: string,
  ) {
    if (viewer.id !== userId) {
      const permissions = await this.rolesService.getUserPermissionKeys(
        viewer.id,
      );
      if (!permissions.includes(PERMISSIONS.SUBSCRIPTION_VIEW_ANY)) {
        throw new ForbiddenException(
          'Bạn không có quyền xem thông tin Subscription của người khác',
        );
      }
    }
    return this.subscriptionService.getMyStatus(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders')
  createOrder(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSubscriptionOrderDto,
  ) {
    return this.subscriptionService.createOrder(user.id, dto.planId);
  }

  // Polling fallback — cùng pattern GET /wallet/topup/:id (wallet.controller.ts).
  @UseGuards(JwtAuthGuard)
  @Get('orders/:id')
  getOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.subscriptionService.getOrder(user.id, id);
  }
}
