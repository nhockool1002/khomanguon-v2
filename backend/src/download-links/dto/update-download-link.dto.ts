import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateDownloadLinkDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  storageProviderId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  objectKey?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceP?: number;
}
