import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  // Không truyền thì tự sinh từ name (xem TagsService.create).
  @IsOptional()
  @IsString()
  @MaxLength(60)
  slug?: string;
}
