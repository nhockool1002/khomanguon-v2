import { IsInt, IsOptional, Max, Min } from 'class-validator';

// SigV4 (S3/R2) không ký được quá 7 ngày — clamp ở DTO để lỗi rõ ngay từ input, không rơi xuống
// tận lúc gọi AWS SDK mới biết sai.
const MAX_EXPIRES_SECONDS = 60 * 60 * 24 * 7;

export class AdminPresignDto {
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(MAX_EXPIRES_SECONDS)
  expiresInSeconds?: number;
}
