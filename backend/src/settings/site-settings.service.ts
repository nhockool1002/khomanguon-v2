import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateGeneralSettingsDto } from './dto/update-general-settings.dto';
import {
  DEFAULT_GENERAL_SETTINGS,
  GENERAL_SETTINGS_KEY,
  type GeneralSettings,
} from './site-settings.types';
import { CacheService } from '../cache/cache.service';

// Ép kiểu an toàn cho cột Json của Prisma — round-trip qua JSON luôn thoả Prisma.InputJsonValue
// (giống hệt lý do trong sepay.service.ts: nest start --watch dùng SWC transpile-only).
function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class SiteSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getGeneralSettings(): Promise<GeneralSettings> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: GENERAL_SETTINGS_KEY },
    });
    if (!row) return DEFAULT_GENERAL_SETTINGS;
    return {
      ...DEFAULT_GENERAL_SETTINGS,
      ...(row.value as Partial<GeneralSettings>),
    };
  }

  async updateGeneralSettings(
    dto: UpdateGeneralSettingsDto,
  ): Promise<GeneralSettings> {
    const current = await this.getGeneralSettings();
    const next: GeneralSettings = {
      ...current,
      ...(dto.postsPerPage !== undefined && { postsPerPage: dto.postsPerPage }),
      ...(dto.headerTitle !== undefined && { headerTitle: dto.headerTitle }),
      ...(dto.headerSlogan !== undefined && { headerSlogan: dto.headerSlogan }),
      ...(dto.headerBackgroundColor !== undefined && {
        headerBackgroundColor: dto.headerBackgroundColor,
      }),
      ...(dto.headerBackgroundImageUrl !== undefined && {
        headerBackgroundImageUrl: dto.headerBackgroundImageUrl,
      }),
      ...(dto.headerBackgroundSize !== undefined && {
        headerBackgroundSize: dto.headerBackgroundSize,
      }),
      ...(dto.headerBackgroundAttachment !== undefined && {
        headerBackgroundAttachment: dto.headerBackgroundAttachment,
      }),
      ...(dto.headerBackgroundPositionX !== undefined && {
        headerBackgroundPositionX: dto.headerBackgroundPositionX,
      }),
      ...(dto.headerBackgroundPositionY !== undefined && {
        headerBackgroundPositionY: dto.headerBackgroundPositionY,
      }),
      ...(dto.headerMinHeight !== undefined && {
        headerMinHeight: dto.headerMinHeight,
      }),
      ...(dto.headerTitleColor !== undefined && {
        headerTitleColor: dto.headerTitleColor,
      }),
      ...(dto.headerTitleFontFamily !== undefined && {
        headerTitleFontFamily: dto.headerTitleFontFamily,
      }),
      ...(dto.headerTitleBold !== undefined && {
        headerTitleBold: dto.headerTitleBold,
      }),
      ...(dto.headerSloganColor !== undefined && {
        headerSloganColor: dto.headerSloganColor,
      }),
      ...(dto.headerSloganFontFamily !== undefined && {
        headerSloganFontFamily: dto.headerSloganFontFamily,
      }),
      ...(dto.headerSloganBold !== undefined && {
        headerSloganBold: dto.headerSloganBold,
      }),
      ...(dto.headerSloganItalic !== undefined && {
        headerSloganItalic: dto.headerSloganItalic,
      }),
      ...(dto.gaTrackingId !== undefined && { gaTrackingId: dto.gaTrackingId }),
      ...(dto.googleSiteVerification !== undefined && {
        googleSiteVerification: dto.googleSiteVerification,
      }),
      ...(dto.footerText !== undefined && { footerText: dto.footerText }),
    };
    await this.prisma.siteSetting.upsert({
      where: { key: GENERAL_SETTINGS_KEY },
      update: { value: toJsonValue(next) },
      create: { key: GENERAL_SETTINGS_KEY, value: toJsonValue(next) },
    });
    await this.cache.invalidatePrefix('settings');
    return next;
  }
}
