import { PostStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsString,
  ValidateIf,
} from 'class-validator';

export const BULK_POST_ACTIONS = ['hide', 'show', 'set-status'] as const;
export type BulkPostAction = (typeof BULK_POST_ACTIONS)[number];

// Bulk Actions ở trang Quản lý bài viết — tối đa 100 bài/lần (trang danh sách hiện tải 50 bài).
export class BulkUpdatePostsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids: string[];

  @IsIn(BULK_POST_ACTIONS)
  action: BulkPostAction;

  // Bắt buộc khi action = 'set-status'.
  @ValidateIf((o: BulkUpdatePostsDto) => o.action === 'set-status')
  @IsEnum(PostStatus)
  status?: PostStatus;
}
