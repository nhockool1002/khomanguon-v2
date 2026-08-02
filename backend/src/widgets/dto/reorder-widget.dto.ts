import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

class ReorderWidgetItemDto {
  @IsString()
  id: string;

  @IsInt()
  @Min(0)
  order: number;
}

// Gửi hàng loạt sau mỗi lần kéo-thả — danh sách phẳng nên chỉ cần order, không có parentId như menu.
export class ReorderWidgetDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderWidgetItemDto)
  items: ReorderWidgetItemDto[];
}
