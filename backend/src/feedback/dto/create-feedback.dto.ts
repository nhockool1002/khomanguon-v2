import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// name/email chỉ dùng khi gửi ẩn danh (không đăng nhập) — FeedbackService bỏ qua 2 field này nếu
// đã xác định được authorId (email lấy từ tài khoản), xem feedback.service.ts create(). email vẫn
// @IsOptional() ở tầng DTO vì người đã đăng nhập không gửi — service tự bắt buộc với khách ẩn danh.
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
