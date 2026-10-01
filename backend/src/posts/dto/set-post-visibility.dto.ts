import { IsBoolean } from 'class-validator';

export class SetPostVisibilityDto {
  // true = ẩn bài đang xuất bản (PUBLISHED -> HIDDEN), false = hiện lại (HIDDEN -> PUBLISHED).
  @IsBoolean()
  hidden: boolean;
}
