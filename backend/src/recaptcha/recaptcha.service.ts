import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { encryptSecret, decryptSecret } from '../common/secret-crypto.util';
import { UpdateRecaptchaConfigDto } from './dto/update-recaptcha-config.dto';
import {
  DEFAULT_RECAPTCHA_CONFIG,
  RECAPTCHA_SECRET_CONTEXT,
  RECAPTCHA_SETTING_KEY,
  type RecaptchaAdminConfig,
  type RecaptchaConfig,
  type RecaptchaConfigPublic,
} from './recaptcha-config.types';

function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getConfig(): Promise<RecaptchaConfig> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: RECAPTCHA_SETTING_KEY },
    });
    if (!row) return DEFAULT_RECAPTCHA_CONFIG;
    return {
      ...DEFAULT_RECAPTCHA_CONFIG,
      ...(row.value as Partial<RecaptchaConfig>),
    };
  }

  async getPublicConfig(): Promise<RecaptchaConfigPublic> {
    const { enabled, siteKey } = await this.getConfig();
    return { enabled, siteKey };
  }

  async getAdminConfig(): Promise<RecaptchaAdminConfig> {
    const config = await this.getConfig();
    return {
      enabled: config.enabled,
      siteKey: config.siteKey,
      hasSecretKey: config.secretKeyEncrypted !== null,
    };
  }

  async updateConfig(
    dto: UpdateRecaptchaConfigDto,
  ): Promise<RecaptchaAdminConfig> {
    const current = await this.getConfig();
    const next: RecaptchaConfig = {
      enabled: dto.enabled,
      siteKey: dto.siteKey,
      secretKeyEncrypted: dto.secretKey
        ? encryptSecret(dto.secretKey, RECAPTCHA_SECRET_CONTEXT)
        : current.secretKeyEncrypted,
    };
    await this.prisma.siteSetting.upsert({
      where: { key: RECAPTCHA_SETTING_KEY },
      update: { value: toJsonValue(next) },
      create: { key: RECAPTCHA_SETTING_KEY, value: toJsonValue(next) },
    });
    return {
      enabled: next.enabled,
      siteKey: next.siteKey,
      hasSecretKey: next.secretKeyEncrypted !== null,
    };
  }

  // enabled=false hoặc chưa cấu hình secret key -> luôn pass (không chặn đăng ký/đăng nhập khi admin
  // chưa bật/setup xong reCAPTCHA). Lỗi mạng gọi Google/parse response -> fail-closed (từ chối) vì
  // đây là 1 control bảo mật, khác các side-effect phụ (mail...) vốn fail-open trong dự án này.
  async verify(token: string | undefined): Promise<boolean> {
    const config = await this.getConfig();
    if (!config.enabled || !config.secretKeyEncrypted) return true;
    if (!token) return false;

    try {
      const secret = decryptSecret(
        config.secretKeyEncrypted,
        RECAPTCHA_SECRET_CONTEXT,
      );
      const res = await fetch(
        'https://www.google.com/recaptcha/api/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret, response: token }).toString(),
        },
      );
      const data = (await res.json()) as { success?: boolean };
      return data.success === true;
    } catch (err) {
      this.logger.warn(
        `Gọi Google reCAPTCHA siteverify thất bại: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }
}
