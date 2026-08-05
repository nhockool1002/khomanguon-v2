import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CloudUploadStatus } from '@prisma/client';

export class CreateCloudUploadRecordDto {
  @IsString()
  fileName: string;

  @IsOptional()
  @IsString()
  objectKey?: string;

  @IsOptional()
  @IsString()
  folder?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @IsEnum(CloudUploadStatus)
  status: CloudUploadStatus;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsString()
  storageProviderId?: string;
}
