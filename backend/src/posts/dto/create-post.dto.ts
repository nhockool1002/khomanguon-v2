import { PostStatus } from '@prisma/client';
import {
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

  // Chưa có WYSIWYG (Phase 2.1) — nhận HTML/text thô từ textarea tạm.
  @IsString()
  @MinLength(1)
  contentHtml: string;

  @IsOptional()
  @IsUrl({}, { message: 'thumbnailUrl phải là một URL hợp lệ' })
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}
