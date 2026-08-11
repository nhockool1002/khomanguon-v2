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
import { SubscriptionPlansService } from './subscription-plans.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { Cacheable } from '../cache/cacheable.decorator';
import { HttpCacheInterceptor } from '../cache/http-cache.interceptor';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';

@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  // Public — card ở trang nạp tiền, chỉ gói đang bật.
  @UseInterceptors(HttpCacheInterceptor)
  @Cacheable('subscriptionPlans', 300)
  @Get()
  listPublic() {
    return this.subscriptionPlansService.listPublic();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_SUBSCRIPTION)
  @Get('admin')
  listAdmin() {
    return this.subscriptionPlansService.listAdmin();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_SUBSCRIPTION)
  @Post()
  create(@Body() dto: CreateSubscriptionPlanDto) {
    return this.subscriptionPlansService.create(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_SUBSCRIPTION)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSubscriptionPlanDto) {
    return this.subscriptionPlansService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_SUBSCRIPTION)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.subscriptionPlansService.remove(id);
  }
}
