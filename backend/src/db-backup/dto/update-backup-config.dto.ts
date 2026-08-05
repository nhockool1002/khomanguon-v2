import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateBackupConfigDto {
  @IsBoolean()
  enabled: boolean;

  @IsInt()
  @Min(0)
  @Max(23)
  hour: number;

  @IsInt()
  @Min(0)
  @Max(59)
  minute: number;

  @IsInt()
  @Min(1)
  @Max(90)
  retentionCount: number;

  @IsOptional()
  @IsString()
  storageProviderId?: string | null;
}
