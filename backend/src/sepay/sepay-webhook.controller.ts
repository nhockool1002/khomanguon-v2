import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { SepayService } from './sepay.service';
import type { SepayWebhookPayload } from './sepay-webhook.types';

// Endpoint public — KHÔNG @UseGuards (auth trong repo này là opt-in theo route, không có cơ chế
// @Public() nào cần dùng, xem JwtAuthGuard chỉ áp khi khai báo). Tự xác thực bằng header
// "Authorization: Apikey <key>" (chế độ "API Key" của SePay — đã verify qua docs.sepay.vn).
// SePay yêu cầu response 200/201 kèm {"success": true} trong 30s, không thì sẽ retry tối đa 7 lần/5h.
@Controller('sepay')
export class SepayWebhookController {
  constructor(private readonly sepayService: SepayService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Headers('authorization') authorization: string | undefined,
    @Body() payload: SepayWebhookPayload,
  ) {
    const providedKey = authorization?.startsWith('Apikey ') ? authorization.slice(7) : undefined;
    const isValid = await this.sepayService.verifyWebhookApiKey(providedKey);
    if (!isValid) throw new UnauthorizedException('Webhook API key không hợp lệ');

    await this.sepayService.matchAndCredit(payload);
    return { success: true };
  }
}
