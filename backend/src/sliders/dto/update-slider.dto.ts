import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SlideDto } from './slide.dto';

const BULLET_STYLES = ['DOTS', 'NUMBERS', 'THUMBNAILS', 'NONE'] as const;
const TRANSITION_STYLES = [
  'SLIDE',
  'FADE',
  'ZOOM',
  'CUBE',
  'COVERFLOW',
] as const;

export class UpdateSliderDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsIn(BULLET_STYLES)
  bulletStyle?: (typeof BULLET_STYLES)[number];

  @IsOptional()
  @IsIn(TRANSITION_STYLES)
  transitionStyle?: (typeof TRANSITION_STYLES)[number];

  @IsOptional()
  @IsBoolean()
  autoplay?: boolean;

  @IsOptional()
  @IsInt()
  @Min(500)
  autoplayDelayMs?: number;

  @IsOptional()
  @IsBoolean()
  loop?: boolean;

  // Không truyền = giữ nguyên slides hiện có; truyền (kể cả mảng rỗng) = thay thế toàn bộ.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlideDto)
  slides?: SlideDto[];
}
