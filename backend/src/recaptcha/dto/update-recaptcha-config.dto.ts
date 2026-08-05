import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateRecaptchaConfigDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  siteKey: string;

  // Để trống = giữ nguyên secret key đã lưu (giống UX ô secret của SePay) — chỉ mã hoá + ghi đè
  // khi admin thật sự nhập giá trị mới.
  @IsOptional()
  @IsString()
  secretKey?: string;
}
