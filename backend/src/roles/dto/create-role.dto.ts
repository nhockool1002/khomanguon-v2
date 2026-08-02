import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { FONT_KEYS } from '../font-options.constant';

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsArray()
  @IsString({ each: true })
  permissionKeys: string[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  title?: string;

  // Cho phép chuỗi rỗng để Admin xoá màu/font đã chọn (quay lại mặc định).
  @IsOptional()
  @IsString()
  @Matches(/^(#[0-9a-fA-F]{6})?$/, { message: 'Màu phải ở dạng hex #rrggbb' })
  color?: string;

  @IsOptional()
  @IsBoolean()
  bold?: boolean;

  @IsOptional()
  @IsBoolean()
  italic?: boolean;

  @IsOptional()
  @IsIn([...FONT_KEYS, ''])
  fontFamily?: string;
}
