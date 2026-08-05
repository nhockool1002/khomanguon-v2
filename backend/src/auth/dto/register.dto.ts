import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @MaxLength(72)
  password: string;

  @IsString()
  @MinLength(2, { message: 'Tên hiển thị phải có ít nhất 2 ký tự' })
  @MaxLength(50)
  displayName: string;

  // Optional ở tầng DTO — RecaptchaService.verify() tự quyết có bắt buộc hay không dựa vào
  // enabled/secretKey đã cấu hình (chưa bật reCAPTCHA thì bỏ qua, không chặn đăng ký).
  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}
