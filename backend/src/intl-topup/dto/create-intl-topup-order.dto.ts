import { Equals, IsBoolean, IsString, MinLength } from 'class-validator';

export class CreateIntlTopupOrderDto {
  @IsString()
  @MinLength(1)
  packageId: string;

  // Bắt buộc tick "Tôi đồng ý $P là tín dụng số, không hoàn tiền" — lưu termsAcceptedAt + IP làm
  // bằng chứng khi có tranh chấp thẻ (chargeback).
  @IsBoolean()
  @Equals(true, { message: 'You must accept the terms to continue' })
  acceptTerms: boolean;
}
