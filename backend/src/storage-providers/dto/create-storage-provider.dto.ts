import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateStorageProviderDto {
  @IsIn(['R2', 'S3', 'MAILJET'])
  type: 'R2' | 'S3' | 'MAILJET';

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  label: string;

  // R2: chỉ cần Account ID (không phải URL đầy đủ) — R2ClientService tự suy ra
  // "https://{endpoint}.r2.cloudflarestorage.com". S3 dùng region thay vì trường này.
  @IsOptional()
  @IsString()
  endpoint?: string;

  @IsOptional()
  @IsString()
  region?: string;

  // Bắt buộc cho R2/S3, không áp dụng cho MAILJET (validate ở service theo type).
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  bucket?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  uploadPrefix?: string;

  // Domain public của bucket (R2 custom domain/r2.dev, S3 static hosting/CloudFront) — chỉ cần khi
  // dùng Provider này làm nguồn Thư viện Media (không bắt buộc cho "Quản lý File Cloud"/download
  // link, vốn luôn dùng presigned URL). Không áp dụng cho MAILJET.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  publicBaseUrl?: string;

  // R2/S3: Access Key ID. MAILJET: API Key.
  @IsString()
  @MinLength(1)
  accessKeyId: string;

  // Nhận plaintext ở DTO — service mã hoá trước khi ghi DB (xem storage-providers.service.ts).
  // R2/S3: Secret Access Key. MAILJET: Secret Key.
  @IsString()
  @MinLength(1)
  secretAccessKey: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
