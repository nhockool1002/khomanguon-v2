import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// name/email chỉ dùng khi gửi ẩn danh (không đăng nhập) — FeedbackService bỏ qua 2 field này nếu
// đã xác định được authorId, xem feedback.service.ts create(). Frontend không gửi field khi để
// trống (bỏ hẳn key thay vì chuỗi rỗng) nên @IsOptional() ở đây là đủ, không cần cho phép "".
export class CreateFeedbackDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
