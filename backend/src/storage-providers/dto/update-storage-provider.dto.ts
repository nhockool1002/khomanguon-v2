import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateStorageProviderDto {
  @IsOptional()
  @IsIn(['R2', 'S3'])
  type?: 'R2' | 'S3';

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsString()
  endpoint?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  bucket?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  uploadPrefix?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  accessKeyId?: string;

  // Để trống khi sửa nếu không muốn đổi secret — chỉ ghi đè khi có giá trị mới.
  @IsOptional()
  @IsString()
  @MinLength(1)
  secretAccessKey?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
