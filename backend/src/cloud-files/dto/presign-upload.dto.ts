import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PresignUploadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename: string;

  // Thư mục con tuỳ chọn (vd "game-pc/2026") — để trống thì upload thẳng gốc bucket theo đúng
  // uploadPrefix đã cấu hình ở Storage Provider (xem cloud-files.service.ts buildUploadKey()).
  @IsOptional()
  @IsString()
  @MaxLength(200)
  folder?: string;

  // Chỉ multipart/init dùng tới (xem cloud-files.service.ts) — PUT đơn không ký kèm Content-Type
  // (tránh SignatureDoesNotMatch) nên bỏ qua field này; multipart thì content-type phải khai báo
  // ngay lúc CreateMultipartUpload vì API S3 không cho set theo từng phần.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contentType?: string;
}
