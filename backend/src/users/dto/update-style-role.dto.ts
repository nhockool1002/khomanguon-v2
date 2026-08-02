import { IsOptional, IsString } from 'class-validator';

// Để trống = xoá lựa chọn, quay về fallback role gán sớm nhất (xem style-role.util.ts).
export class UpdateStyleRoleDto {
  @IsOptional()
  @IsString()
  roleSlug?: string;
}
