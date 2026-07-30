import { IsArray, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsArray()
  @IsString({ each: true })
  permissionKeys: string[];
}
