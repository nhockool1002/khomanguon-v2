import { CommentStatus } from '@prisma/client';
import { IsBoolean, IsEnum } from 'class-validator';

export class UpdateCommentStatusDto {
  @IsEnum(CommentStatus)
  status: CommentStatus;
}

export class PinCommentDto {
  @IsBoolean()
  pinned: boolean;
}
