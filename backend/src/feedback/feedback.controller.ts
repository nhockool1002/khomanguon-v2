import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FeedbackStatus } from '@prisma/client';
import { FeedbackService } from './feedback.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PublicRateLimitGuard } from '../common/rate-limit/public-rate-limit.guard';
import { RateLimitKey } from '../common/rate-limit/rate-limit-key.decorator';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackStatusDto } from './dto/update-feedback-status.dto';

interface AuthUser {
  id: string;
  email: string;
}

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  // Public — modal Feedback gọi được cả khi chưa đăng nhập (OptionalJwtAuthGuard không chặn, chỉ
  // gắn user nếu có token hợp lệ). Rate limit theo IP (PublicRateLimitGuard) vì khách ẩn danh không
  // có identity nào khác để chặn spam.
  @UseGuards(PublicRateLimitGuard, OptionalJwtAuthGuard)
  @RateLimitKey('feedbackCreate')
  @Post()
  create(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: CreateFeedbackDto,
  ) {
    return this.feedbackService.create(user?.id ?? null, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.FEEDBACK_MANAGE)
  @Get()
  list(
    @Query('status') status?: FeedbackStatus,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.feedbackService.listForModeration({
      status,
      q: q?.trim() || undefined,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.FEEDBACK_MANAGE)
  @Patch(':id/status')
  resolve(
    @Param('id') id: string,
    @Body() _dto: UpdateFeedbackStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feedbackService.resolve(id, user.id);
  }
}
