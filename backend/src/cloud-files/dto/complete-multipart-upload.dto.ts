import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class UploadedPartDto {
  @IsInt()
  @Min(1)
  partNumber: number;

  // Trả về từ header ETag của response khi PUT từng part — bucket dùng để đối chiếu khi ráp file
  // (CompleteMultipartUpload thất bại ngay nếu ETag sai/thiếu, không cần validate thêm ở đây).
  @IsString()
  @MinLength(1)
  eTag: string;
}

export class CompleteMultipartUploadDto {
  @IsString()
  @MinLength(1)
  key: string;

  @IsString()
  @MinLength(1)
  uploadId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UploadedPartDto)
  parts: UploadedPartDto[];
}
