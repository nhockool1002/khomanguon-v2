import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class TopupPresetDto {
  @IsInt()
  @Min(1000)
  vnd: number;

  @IsInt()
  @Min(1)
  p: number;
}

export class UpdateSepayConfigDto {
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountHolderName?: string;

  // Để trống khi sửa nếu không muốn đổi key hiện tại — chỉ ghi đè khi có giá trị mới.
  @IsOptional()
  @IsString()
  @MinLength(1)
  webhookApiKey?: string;

  // Token "API Access" của SePay — chỉ dùng cho nút "Thử kết nối API", để trống nếu không đổi.
  @IsOptional()
  @IsString()
  @MinLength(1)
  apiAccessToken?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  baseRateVndPerP?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TopupPresetDto)
  presets?: TopupPresetDto[];
}
