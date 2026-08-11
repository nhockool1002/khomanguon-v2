import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSubscriptionPlanDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsInt()
  @Min(1)
  durationDays: number;

  @IsInt()
  @Min(1)
  priceVnd: number;

  // null = không giới hạn — @IsOptional() bỏ qua validate khi giá trị là null/undefined.
  @IsOptional()
  @IsInt()
  @Min(1)
  totalDownloadLimit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  dailyDownloadLimit?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;
}
