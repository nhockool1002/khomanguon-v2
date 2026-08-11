import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateSubscriptionOrderDto } from './dto/create-subscription-order.dto';

interface AuthUser {
  id: string;
  email: string;
}

@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // Trạng thái gói hiện tại của chính mình (null nếu không có kỳ nào đang hiệu lực) — trang nạp
  // tiền dùng để hiện "Bạn đang dùng gói X, còn Y ngày, đã tải Z/N link".
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMyStatus(@CurrentUser() user: AuthUser) {
    return this.subscriptionService.getMyStatus(user.id);
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
