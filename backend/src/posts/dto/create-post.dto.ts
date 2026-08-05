import { PostStatus } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  // Không truyền thì tự sinh từ title (xem PostsService.ensureUniqueSlug).
  @IsOptional()
  @IsString()
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  // WYSIWYG Tiptap (Phase 2.1) — HTML thật, FE luôn gửi URL ảnh tuyệt đối (đã ghép NEXT_PUBLIC_API_URL).
  @IsString()
  @MinLength(1)
  contentHtml: string;

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
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  // SEO — UC14
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
