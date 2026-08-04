import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class ReorderCategoryItemDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsInt()
  @Min(0)
  order: number;
}

// Gửi hàng loạt sau mỗi lần kéo-thả — FE tính lại order/parentId của các mục bị ảnh hưởng rồi gộp 1 request
// (giống hệt ReorderMenuDto ở backend/src/menus/dto/reorder-menu.dto.ts).
export class ReorderCategoryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderCategoryItemDto)
  items: ReorderCategoryItemDto[];
}
