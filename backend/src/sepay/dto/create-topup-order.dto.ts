import { IsInt, Min } from 'class-validator';

export class CreateTopupOrderDto {
  @IsInt()
  @Min(100000) // tối thiểu 100.000đ — tránh giao dịch quá nhỏ không đáng để đối soát
  amountVnd: number;
}
