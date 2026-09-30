import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class IntlTopupPackageDto {
  @IsInt()
  @Min(1)
  @Max(10000)
  amountUsd: number;

  @IsInt()
  @Min(1)
  amountP: number;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  bmcExtraUrl?: string;

  @IsBoolean()
  isActive: boolean;
}

// Lưu cả cấu hình lẫn toàn bộ danh sách gói trong 1 lần bấm "Lưu cấu hình" (giống trang SePay) —
// packages thay thế trọn danh sách cũ (đơn nạp đã chụp lại số tiền/$P nên không bị ảnh hưởng).
export class UpdateIntlPaymentSettingsDto {
  @IsOptional()
  @IsUrl({ require_protocol: true })
  bmcPageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  usdToVndRate?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  paymentWindowHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxOpenOrdersPerUser?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  sellerName?: string;

  @IsOptional()
  @IsEmail()
  sellerEmail?: string;

  @IsOptional()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => IntlTopupPackageDto)
  packages?: IntlTopupPackageDto[];
}
