import { PostStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  contentHtml?: string;

  @IsOptional()
  @IsUrl(
    { require_tld: false },
    { message: 'thumbnailUrl phải là một URL hợp lệ' },
  )
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  metaDescription?: string;

  @IsOptional()
  @IsUrl(
    { require_tld: false },
    { message: 'ogImageUrl phải là một URL hợp lệ' },
  )
  ogImageUrl?: string;

  @IsOptional()
  @IsUrl(
    { require_tld: false },
    { message: 'canonicalUrl phải là một URL hợp lệ' },
  )
  canonicalUrl?: string;
}
