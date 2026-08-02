import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const WIDGET_TYPES = [
  'SEARCH',
  'CATEGORIES',
  'RECENT_POSTS',
  'HTML',
  'COMMENTS',
] as const;

export class CreateWidgetDto {
  @IsIn(WIDGET_TYPES)
  type: (typeof WIDGET_TYPES)[number];

  @IsString()
  @MaxLength(100)
  title: string;

  // {limit} cho RECENT_POSTS, {html} cho HTML — rỗng với SEARCH/CATEGORIES.
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Rỗng/không truyền = hiển thị công khai, xem Widget.visibleTo trong schema.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleSlugs?: string[];
}
