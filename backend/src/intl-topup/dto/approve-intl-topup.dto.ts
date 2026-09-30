import {
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ApproveIntlTopupDto {
  // Số USD thực nhận trên BMC (có thể lẻ cent) — lưu dạng cent.
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100000)
  receivedUsd: number;

  // $P thực cộng — FE điền sẵn theo gói/tỉ giá, Admin sửa được.
  @IsInt()
  @Min(1)
  creditedP: number;

  // Mã/ID giao dịch trên BMC — bắt buộc để đối chiếu khi có tranh chấp.
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  bmcTransactionRef: string;
}
