import { IsString, MinLength } from 'class-validator';

export class AbortMultipartUploadDto {
  @IsString()
  @MinLength(1)
  key: string;

  @IsString()
  @MinLength(1)
  uploadId: string;
}
