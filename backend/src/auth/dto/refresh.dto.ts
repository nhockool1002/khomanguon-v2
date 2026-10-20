import { IsOptional, IsString } from 'class-validator';

// Web frontend không gửi field này (dùng cookie httpOnly) — chỉ client có x-extension-key hợp lệ
// (xem AuthController.refresh) mới cần fallback qua body, vì cookie refresh_token thường không
// tới được iframe K-Extension (Chrome chặn cookie bên thứ ba trong iframe nhúng site khác).
export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
