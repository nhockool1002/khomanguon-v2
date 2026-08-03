import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import type {
  HeaderBackgroundAttachment,
  HeaderBackgroundSize,
} from '../site-settings.types';

export class UpdateGeneralSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  postsPerPage?: number;

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
}
