import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { FONT_KEYS } from '../font-options.constant';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];

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

  // Cấu hình quyền hạn User Title (khác title ở trên — đây là quyền cho USER thuộc role này tự đặt
  // dòng chữ riêng, xem roles/user-title.util.ts). null = đổi tự do, không giới hạn ngày.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  userTitleCooldownDays?: number | null;

  @IsOptional()
  @IsBoolean()
  userTitleAllowHtml?: boolean;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(2000)
  userTitleMaxLength?: number;
}
