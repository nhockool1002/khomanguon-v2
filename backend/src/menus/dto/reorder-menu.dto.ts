import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class ReorderMenuItemDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsInt()
  @Min(0)
  order: number;
}

// Gửi hàng loạt sau mỗi lần kéo-thả — FE tính lại order/parentId của các mục bị ảnh hưởng rồi gộp 1 request.
export class ReorderMenuDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderMenuItemDto)
  items: ReorderMenuItemDto[];
}
