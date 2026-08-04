import { IsString } from 'class-validator';

// Không @MaxLength cố định ở đây — giới hạn độ dài/HTML tuỳ theo role của user (gộp qua
// roles/user-title.util.ts), chỉ users.service.ts mới biết được nên validate ở tầng service.
export class UpdateUserTitleDto {
  @IsString()
  title: string;
}
