import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpsertDownloadLinkDto {
  @IsString()
  @MinLength(1)
  label: string;

  @IsString()
  @MinLength(1)
  storageProviderId: string;

  // Object key/path trong bucket — vd "source-code/example.zip" (xem placeholder trong form FE).
  @IsString()
  @MinLength(1)
  objectKey: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @IsInt()
  @Min(0)
  priceP: number;
}
