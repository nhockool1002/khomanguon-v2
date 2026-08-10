import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { PublicRateLimitGuard } from '../common/rate-limit/public-rate-limit.guard';
import { RateLimitKey } from '../common/rate-limit/rate-limit-key.decorator';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { UnsubscribeNewsletterDto } from './dto/unsubscribe-newsletter.dto';
import { UpdateNewsletterConfigDto } from './dto/update-newsletter-config.dto';

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @UseGuards(PublicRateLimitGuard)
  @RateLimitKey('newsletterSubscribe')
  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  subscribe(@Body() dto: SubscribeNewsletterDto) {
    return this.newsletterService.subscribe(dto.email);
  }

  // Không rate-limit (khác subscribe) — link trong email chỉ bấm được bởi người có link thật,
  // không phải form công khai ai cũng gõ được.
  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  unsubscribe(@Body() dto: UnsubscribeNewsletterDto) {
    return this.newsletterService.unsubscribe(dto.id, dto.token);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.NEWSLETTER_MANAGE)
  @Get('config')
  getConfig() {
    return this.newsletterService.getConfig();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.NEWSLETTER_MANAGE)
  @Put('config')
  updateConfig(@Body() dto: UpdateNewsletterConfigDto) {
    return this.newsletterService.updateConfig(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.NEWSLETTER_MANAGE)
  @Get('subscriber-count')
  getSubscriberCount() {
    return this.newsletterService.getSubscriberCount();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.NEWSLETTER_MANAGE)
  @Post('run-now')
  runNow() {
    return this.newsletterService.sendDigestNow();
  }
}
