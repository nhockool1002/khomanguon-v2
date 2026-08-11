import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { SepayService } from './sepay.service';
import type { SepayWebhookPayload } from './sepay-webhook.types';
// Chỉ SubscriptionModule phụ thuộc SepayModule (1 chiều) — lấy SubscriptionService qua ModuleRef
// bên dưới thay vì khai báo SubscriptionModule trong SepayModule.imports, để tránh vòng phụ thuộc
// module (SepayModule <-> SubscriptionModule). SepayModule/SepayService không đổi gì cả.
import { SubscriptionService } from '../subscriptions/subscription.service';

// Endpoint public — KHÔNG @UseGuards (auth trong repo này là opt-in theo route, không có cơ chế
// @Public() nào cần dùng, xem JwtAuthGuard chỉ áp khi khai báo). Tự xác thực bằng header
// "Authorization: Apikey <key>" (chế độ "API Key" của SePay — đã verify qua docs.sepay.vn).
// SePay yêu cầu response 200/201 kèm {"success": true} trong 30s, không thì sẽ retry tối đa 7 lần/5h.
@Controller('sepay')
export class SepayWebhookController {
  constructor(
    private readonly sepayService: SepayService,
    private readonly moduleRef: ModuleRef,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Headers('authorization') authorization: string | undefined,
    @Body() payload: SepayWebhookPayload,
  ) {
    const providedKey = authorization?.startsWith('Apikey ')
      ? authorization.slice(7)
      : undefined;
    const isValid = await this.sepayService.verifyWebhookApiKey(providedKey);
    if (!isValid)
      throw new UnauthorizedException('Webhook API key không hợp lệ');

    // Luồng nạp $P hiện có — KHÔNG đổi gì, gọi y hệt trước đây.
    const topupResult = await this.sepayService.matchAndCredit(payload);

    // Chỉ thử khớp đơn Subscription khi luồng nạp $P ở trên KHÔNG khớp — 1 giao dịch chuyển khoản
    // chỉ có thể ứng với 1 loại đơn (mã "GD" của TopupOrder và "SUB" của SubscriptionOrder không
    // bao giờ trùng nhau), nên không xử lý song song 2 lần cho cùng 1 giao dịch. Lấy
    // SubscriptionService qua ModuleRef (strict:false = tìm trên toàn bộ app, không cần
    // SepayModule.imports khai báo SubscriptionModule) để tránh vòng phụ thuộc module — xem comment
    // import ở trên.
    if (!topupResult.credited) {
      const subscriptionService = this.moduleRef.get(SubscriptionService, {
        strict: false,
      });
      await subscriptionService.matchAndActivateFromWebhook(payload);
    }

    return { success: true };
  }
}
