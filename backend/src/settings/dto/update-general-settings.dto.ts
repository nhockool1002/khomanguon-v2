import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type {
  HeaderBackgroundAttachment,
  HeaderBackgroundSize,
} from '../site-settings.types';

export class RateLimitRuleDto {
  @IsInt()
  @Min(1)
  windowSec: number;

  @IsInt()
  @Min(1)
  max: number;
}

export class RateLimitSettingsDto {
  @IsBoolean()
  enabled: boolean;

  @ValidateNested()
  @Type(() => RateLimitRuleDto)
  login: RateLimitRuleDto;

  @ValidateNested()
  @Type(() => RateLimitRuleDto)
  register: RateLimitRuleDto;

  @ValidateNested()
  @Type(() => RateLimitRuleDto)
  forgotPassword: RateLimitRuleDto;

  @ValidateNested()
  @Type(() => RateLimitRuleDto)
  resetPassword: RateLimitRuleDto;

  @ValidateNested()
  @Type(() => RateLimitRuleDto)
  search: RateLimitRuleDto;

  @ValidateNested()
  @Type(() => RateLimitRuleDto)
  commentCreate: RateLimitRuleDto;

  @ValidateNested()
  @Type(() => RateLimitRuleDto)
  feedbackCreate: RateLimitRuleDto;

  @ValidateNested()
  @Type(() => RateLimitRuleDto)
  newsletterSubscribe: RateLimitRuleDto;
}

export class MaintenanceModeDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  @MaxLength(2000)
  message: string;
}

export class UpdateGeneralSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  postsPerPage?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  siteTitle?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  headerTitle?: string;

  @IsOptional()
  @IsString()
  headerSlogan?: string;

  @IsOptional()
  @IsString()
  headerBackgroundColor?: string;

  // null để xoá ảnh nền hiện tại (quay lại dùng màu nền) — undefined (bỏ trống field) giữ nguyên.
  @IsOptional()
  @IsString()
  headerBackgroundImageUrl?: string | null;

  @IsOptional()
  @IsIn(['cover', 'contain', 'auto'])
  headerBackgroundSize?: HeaderBackgroundSize;

  @IsOptional()
  @IsIn(['scroll', 'fixed'])
  headerBackgroundAttachment?: HeaderBackgroundAttachment;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  headerBackgroundPositionX?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  headerBackgroundPositionY?: number;

  @IsOptional()
  @IsInt()
  @Min(120)
  @Max(600)
  headerMinHeight?: number;

  @IsOptional()
  @IsString()
  headerTitleColor?: string;

  @IsOptional()
  @IsString()
  headerTitleFontFamily?: string | null;

  @IsOptional()
  @IsBoolean()
  headerTitleBold?: boolean;

  @IsOptional()
  @IsString()
  headerSloganColor?: string;

  @IsOptional()
  @IsString()
  headerSloganFontFamily?: string | null;

  @IsOptional()
  @IsBoolean()
  headerSloganBold?: boolean;

  @IsOptional()
  @IsBoolean()
  headerSloganItalic?: boolean;

  @IsOptional()
  @IsString()
  gaTrackingId?: string;

  @IsOptional()
  @IsString()
  googleSiteVerification?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  footerText?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RateLimitSettingsDto)
  rateLimits?: RateLimitSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MaintenanceModeDto)
  maintenanceMode?: MaintenanceModeDto;
}
