import { IsEmail } from 'class-validator';

export class ClaimIntlTopupPaidDto {
  // Email user đã dùng khi thanh toán trên Buy Me a Coffee — Admin đối chiếu trên ví BMC.
  @IsEmail({}, { message: 'Please enter a valid email' })
  payerEmail: string;
}
