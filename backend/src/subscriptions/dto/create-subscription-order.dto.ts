import { IsString, MinLength } from 'class-validator';

export class CreateSubscriptionOrderDto {
  @IsString()
  @MinLength(1)
  planId: string;
}
