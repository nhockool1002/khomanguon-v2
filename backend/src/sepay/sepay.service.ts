import { randomInt } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TopupOrderStatus, WalletTxStatus, WalletTxType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletGateway } from '../realtime/wallet.gateway';
import { encryptSecret, decryptSecret } from '../common/secret-crypto.util';
import { UpdateSepayConfigDto } from './dto/update-sepay-config.dto';
import {
  DEFAULT_SEPAY_CONFIG,
  SEPAY_SECRET_CONTEXT,
  SEPAY_SETTING_KEY,
  type SepayConfig,
  type SepayConfigPublic,
} from './sepay-config.types';
import type { SepayWebhookPayload } from './sepay-webhook.types';

const ORDER_TTL_MINUTES = 30;

@Injectable()
export class SepayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletGateway: WalletGateway,
  ) {}

  // ───────────────────────── Cấu hình (Admin) ─────────────────────────

  async getConfig(): Promise<SepayConfig> {
    const row = await this.prisma.siteSetting.findUnique({ where: { key: SEPAY_SETTING_KEY } });
    if (!row) return DEFAULT_SEPAY_CONFIG;
    return { ...DEFAULT_SEPAY_CONFIG, ...(row.value as Partial<SepayConfig>) };
  }

  async getPublicConfig(): Promise<SepayConfigPublic> {
    const { webhookApiKeyEncrypted, apiAccessTokenEncrypted, ...rest } = await this.getConfig();
    return { ...rest, hasApiKey: !!webhookApiKeyEncrypted, hasApiAccessToken: !!apiAccessTokenEncrypted };
  }

  // Dùng cho trang nạp tiền của member — chỉ tỉ giá/gói nạp, không lộ STK/API key
  // (khác getPublicConfig() vốn dành cho Admin xem lại toàn bộ cấu hình không nhạy cảm).
  async getTopupPresets(): Promise<Pick<SepayConfig, 'baseRateVndPerP' | 'presets'>> {
    const { baseRateVndPerP, presets } = await this.getConfig();
    return { baseRateVndPerP, presets };
  }

  async updateConfig(dto: UpdateSepayConfigDto): Promise<SepayConfigPublic> {
    const current = await this.getConfig();
    const next: SepayConfig = {
      ...current,
      ...(dto.bankAccountNumber !== undefined && { bankAccountNumber: dto.bankAccountNumber }),
      ...(dto.bankName !== undefined && { bankName: dto.bankName }),
      ...(dto.accountHolderName !== undefined && { accountHolderName: dto.accountHolderName }),
      ...(dto.baseRateVndPerP !== undefined && { baseRateVndPerP: dto.baseRateVndPerP }),
      ...(dto.presets !== undefined && { presets: dto.presets }),
      ...(dto.webhookApiKey && {
        webhookApiKeyEncrypted: encryptSecret(dto.webhookApiKey, SEPAY_SECRET_CONTEXT),
      }),
      ...(dto.apiAccessToken && {
        apiAccessTokenEncrypted: encryptSecret(dto.apiAccessToken, SEPAY_SECRET_CONTEXT),
      }),
    };
    await this.prisma.siteSetting.upsert({
      where: { key: SEPAY_SETTING_KEY },
      update: { value: next as object },
      create: { key: SEPAY_SETTING_KEY, value: next as object },
    });
    const { webhookApiKeyEncrypted, apiAccessTokenEncrypted, ...rest } = next;
    return { ...rest, hasApiKey: !!webhookApiKeyEncrypted, hasApiAccessToken: !!apiAccessTokenEncrypted };
  }

  async verifyWebhookApiKey(providedKey: string | undefined): Promise<boolean> {
    if (!providedKey) return false;
    const config = await this.getConfig();
    if (!config.webhookApiKeyEncrypted) return false;
    try {
      const realKey = decryptSecret(config.webhookApiKeyEncrypted, SEPAY_SECRET_CONTEXT);
      return realKey === providedKey;
    } catch {
      return false;
    }
  }

  // Gọi thử API "Danh sách giao dịch" của SePay bằng API Access Token đã lưu — dùng để hoàn thành
  // checklist "Thử kết nối API" trên dashboard SePay, không phục vụ nghiệp vụ nào khác trong app
  // (đã verify endpoint + header qua docs.sepay.vn: GET /userapi/transactions/list, Bearer token).
  async testApiConnection(): Promise<{ success: boolean; message: string }> {
    const config = await this.getConfig();
    if (!config.apiAccessTokenEncrypted) {
      return { success: false, message: 'Chưa cấu hình API Access Token — nhập token rồi lưu lại trước khi test.' };
    }

    let token: string;
    try {
      token = decryptSecret(config.apiAccessTokenEncrypted, SEPAY_SECRET_CONTEXT);
    } catch {
      return { success: false, message: 'Không giải mã được API Access Token đã lưu — hãy nhập lại.' };
    }

    try {
      const res = await fetch('https://my.sepay.vn/userapi/transactions/list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        return { success: false, message: `SePay trả về lỗi ${res.status} — kiểm tra lại API Access Token.` };
      }
      const body = (await res.json()) as { transactions?: unknown[] };
      const count = Array.isArray(body.transactions) ? body.transactions.length : 0;
      return { success: true, message: `Kết nối thành công — SePay trả về ${count} giao dịch.` };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Không thể kết nối tới SePay: ${detail}` };
    }
  }

  // ───────────────────────── VietQR ─────────────────────────

  // Không cần gọi API SePay để tạo QR — nhúng thẳng ảnh vietqr.app (đã verify qua docs.sepay.vn),
  // không cần credentials.
  buildVietQrUrl(config: Pick<SepayConfig, 'bankAccountNumber' | 'bankName'>, amountVnd: number, code: string): string {
    const params = new URLSearchParams({
      acc: config.bankAccountNumber,
      bank: config.bankName,
      amount: String(amountVnd),
      des: code,
    });
    return `https://vietqr.app/img?${params.toString()}`;
  }

  // ───────────────────────── Tạo yêu cầu nạp tiền ─────────────────────────

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = `GD${randomInt(100000, 999999)}`;
      const existing = await this.prisma.topupOrder.findUnique({ where: { code } });
      if (!existing) return code;
    }
    throw new Error('Không sinh được mã giao dịch nạp tiền duy nhất — thử lại');
  }

  private computeAmountP(config: SepayConfig, amountVnd: number): number {
    const preset = config.presets.find((p) => p.vnd === amountVnd);
    if (preset) return preset.p;
    return Math.floor(amountVnd / config.baseRateVndPerP);
  }

  async createTopupOrder(userId: string, amountVnd: number) {
    const config = await this.getConfig();
    if (!config.bankAccountNumber || !config.bankName) {
      throw new BadRequestException('SePay chưa được cấu hình — liên hệ Admin cài đặt STK ngân hàng trước');
    }

    const code = await this.generateUniqueCode();
    const amountP = this.computeAmountP(config, amountVnd);
    const expiresAt = new Date(Date.now() + ORDER_TTL_MINUTES * 60_000);

    const order = await this.prisma.topupOrder.create({
      data: { userId, code, amountVnd, amountP, expiresAt },
    });

    return { order, qrUrl: this.buildVietQrUrl(config, amountVnd, code) };
  }

  async getTopupOrder(userId: string, id: string) {
    const order = await this.prisma.topupOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Không tìm thấy yêu cầu nạp tiền');
    if (order.userId !== userId) throw new ForbiddenException('Bạn không có quyền xem yêu cầu này');
    return order;
  }

  async listTransactions(userId: string, page: number, limit: number) {
    const take = Math.min(Math.max(limit, 1), 50);
    const skip = (Math.max(page, 1) - 1) * take;
    const wallet = await this.prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
    });
    const [items, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);
    return { items, total };
  }

  // ───────────────────────── Webhook ─────────────────────────

  // Idempotent theo sepayTransactionCode (SePay retry tối đa 7 lần trong 5h nếu server không trả
  // {success:true} kịp — UC23). Không khớp/không đúng số tiền -> chỉ log lại để Admin đối soát tay
  // qua WALLET_ADJUST, KHÔNG tự động cộng nhầm.
  async matchAndCredit(payload: SepayWebhookPayload): Promise<{ credited: boolean }> {
    const sepayTransactionCode = String(payload.id);
    const existing = await this.prisma.sepayTransaction.findUnique({ where: { sepayTransactionCode } });
    if (existing) return { credited: existing.status === WalletTxStatus.SUCCESS };

    if (payload.transferType !== 'in') {
      await this.prisma.sepayTransaction.create({
        data: {
          sepayTransactionCode,
          amountVnd: payload.transferAmount,
          pCredited: 0,
          rawPayload: payload as object,
          status: WalletTxStatus.FAILED,
        },
      });
      return { credited: false };
    }

    const haystack = `${payload.content ?? ''} ${payload.code ?? ''}`;
    const candidates = await this.prisma.topupOrder.findMany({
      where: { status: TopupOrderStatus.PENDING },
    });
    const order = candidates.find((o) => haystack.includes(o.code));

    if (!order || order.amountVnd !== payload.transferAmount) {
      await this.prisma.sepayTransaction.create({
        data: {
          sepayTransactionCode,
          amountVnd: payload.transferAmount,
          pCredited: 0,
          rawPayload: payload as object,
          status: WalletTxStatus.FAILED,
        },
      });
      return { credited: false };
    }

    let newBalance = 0;
    await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId: order.userId },
        update: {},
        create: { userId: order.userId, balance: 0 },
      });
      newBalance = wallet.balance + order.amountP;

      const walletTransaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTxType.TOPUP,
          amount: order.amountP,
          balanceAfter: newBalance,
          status: WalletTxStatus.SUCCESS,
          referenceType: 'sepay_topup',
          referenceId: order.id,
        },
      });

      await tx.wallet.update({ where: { userId: order.userId }, data: { balance: newBalance } });
      await tx.topupOrder.update({
        where: { id: order.id },
        data: { status: TopupOrderStatus.SUCCESS, walletTransactionId: walletTransaction.id },
      });
      await tx.sepayTransaction.create({
        data: {
          sepayTransactionCode,
          walletTransactionId: walletTransaction.id,
          amountVnd: payload.transferAmount,
          pCredited: order.amountP,
          rawPayload: payload as object,
          status: WalletTxStatus.SUCCESS,
        },
      });
    });

    this.walletGateway.emitWalletUpdated(order.userId, { balance: newBalance, topupOrderId: order.id });
    return { credited: true };
  }

  // ───────────────────────── Cron ─────────────────────────

  async expirePendingOrders(): Promise<number> {
    const result = await this.prisma.topupOrder.updateMany({
      where: { status: TopupOrderStatus.PENDING, expiresAt: { lt: new Date() } },
      data: { status: TopupOrderStatus.EXPIRED },
    });
    return result.count;
  }
}
