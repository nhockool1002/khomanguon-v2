import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { MailService } from './mail.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateMailTemplatesDto } from './dto/update-mail-templates.dto';

interface AuthUser {
  id: string;
  email: string;
}

const VALID_KINDS = [
  'topupSuccess',
  'downloadUnlock',
  'passwordReset',
  'linkReportAdmin',
  'linkReportResolved',
  'verifyEmail',
  'feedbackAdmin',
] as const;
type NotificationKind = (typeof VALID_KINDS)[number];

@Controller('mail/templates')
export class MailTemplatesController {
  constructor(private readonly mailService: MailService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_MAIL)
  @Get()
  getTemplates() {
    return this.mailService.getTemplates();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_MAIL)
  @Put()
  updateTemplates(@Body() dto: UpdateMailTemplatesDto) {
    return this.mailService.updateTemplates(dto);
  }

  // Gửi thử bằng dữ liệu mẫu tới notifyEmail đã lưu + email của chính admin đang bấm nút (mô phỏng
  // đúng luồng thật: Admin nhận + user vừa nạp/tải nhận) — xác nhận cấu hình Mailjet/SMTP + nội
  // dung template render đúng trước khi chờ có giao dịch/lượt tải thật.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SETTINGS_MAIL)
  @Post('test-send/:kind')
  testSend(@Param('kind') kind: string, @CurrentUser() user: AuthUser) {
    if (!VALID_KINDS.includes(kind as NotificationKind)) {
      throw new BadRequestException('kind không hợp lệ');
    }
    return this.mailService.sendTestNotification(
      kind as NotificationKind,
      user.email,
    );
  }
}
