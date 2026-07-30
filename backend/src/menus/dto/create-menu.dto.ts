import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateMenuDto {
  @IsString()
  @MaxLength(100)
  label: string;

  @IsString()
  @MaxLength(255)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;

  @IsOptional()
  @IsBoolean()
  openInNewTab?: boolean;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  // Rỗng/không truyền = hiển thị công khai (mọi người xem được), xem Menu.visibleTo trong schema.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleSlugs?: string[];
}
