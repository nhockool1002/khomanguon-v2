import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  NotEquals,
} from 'class-validator';

export class AdjustWalletDto {
  @IsEmail()
  userEmail: string;

  // Dương = cộng $P, âm = trừ $P — không cho phép 0 (không tạo giao dịch rỗng)
  @IsInt()
  @NotEquals(0)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
