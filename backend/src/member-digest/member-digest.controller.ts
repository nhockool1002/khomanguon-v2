import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MemberDigestTrigger } from '@prisma/client';
import { MemberDigestService } from './member-digest.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateMemberDigestConfigDto } from './dto/update-member-digest-config.dto';

interface AuthUser {
  id: string;
  email: string;
}

// Mọi route đều quản trị — không có route công khai nào (khác newsletter.controller.ts có
// subscribe/unsubscribe công khai), vì đối tượng nhận là User đã có tài khoản, không cần form
// đăng ký riêng.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(PERMISSIONS.MEMBER_DIGEST_MANAGE)
@Controller('member-digest')
export class MemberDigestController {
  constructor(private readonly memberDigestService: MemberDigestService) {}

  @Get('config')
  getConfig() {
    return this.memberDigestService.getConfig();
  }

  @Put('config')
  updateConfig(@Body() dto: UpdateMemberDigestConfigDto) {
    return this.memberDigestService.updateConfig(dto);
  }

  @Get('eligible-count')
  getEligibleCount() {
    return this.memberDigestService.getEligibleRecipientCount();
  }

  @Post('run-now')
  @HttpCode(HttpStatus.OK)
  runNow() {
    return this.memberDigestService.createBatchIfDue(
      MemberDigestTrigger.MANUAL,
    );
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  sendTest(@CurrentUser() user: AuthUser) {
    return this.memberDigestService.sendTestEmail(user.email);
  }

  @Get('batches')
  listBatches(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.memberDigestService.listBatches(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('batches/:id/recipients')
  getBatchRecipients(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.memberDigestService.getBatchRecipients(
      id,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }
}
