import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class PresignUploadPartDto {
  @IsString()
  @MinLength(1)
  key: string;

  @IsString()
  @MinLength(1)
  uploadId: string;

  // S3/R2 multipart: PartNumber trong khoảng 1..10000.
  @IsInt()
  @Min(1)
  @Max(10000)
  partNumber: number;
}
