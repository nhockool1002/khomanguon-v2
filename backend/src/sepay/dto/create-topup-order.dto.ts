import { IsInt, Min } from 'class-validator';

export class CreateTopupOrderDto {
  @IsInt()
  @Min(10000) // tối thiểu 10.000đ — tránh giao dịch quá nhỏ không đáng để đối soát
  amountVnd: number;
}
