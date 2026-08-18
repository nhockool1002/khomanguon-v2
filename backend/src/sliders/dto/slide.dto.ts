import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MaxLength,
} from 'class-validator';

// Dùng chung cho create/update Slider — mỗi lần lưu gửi lại TOÀN BỘ mảng slides, service xoá hết
// rồi tạo lại (giống syncRoles() của widgets), không có endpoint sửa từng slide riêng lẻ.
// require_tld: false — FE gửi URL tuyệt đối ghép NEXT_PUBLIC_API_URL (có thể là localhost lúc dev),
// cùng quy ước với thumbnailUrl/ogImageUrl ở create-post.dto.ts.
export class SlideDto {
  @IsUrl({ require_tld: false }, { message: 'imageUrl phải là một URL hợp lệ' })
  imageUrl: string;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'linkUrl phải là một URL hợp lệ' })
  linkUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  caption?: string;

  @IsInt()
  @Min(0)
  order: number;
}
