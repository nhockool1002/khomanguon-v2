import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class MailTemplateConfigDto {
  @IsString()
  @MinLength(1)
  subject: string;

  @IsString()
  @MinLength(1)
  html: string;
}

export class UpdateMailTemplatesDto {
  // Cho phép chuỗi rỗng để tắt gửi thông báo — không ép @IsEmail() để tránh chặn nhầm khi tắt.
  @IsOptional()
  @IsString()
  notifyEmail?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MailTemplateConfigDto)
  topupSuccess?: MailTemplateConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MailTemplateConfigDto)
  downloadUnlock?: MailTemplateConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MailTemplateConfigDto)
  passwordReset?: MailTemplateConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MailTemplateConfigDto)
  linkReportAdmin?: MailTemplateConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MailTemplateConfigDto)
  linkReportResolved?: MailTemplateConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MailTemplateConfigDto)
  verifyEmail?: MailTemplateConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MailTemplateConfigDto)
  feedbackAdmin?: MailTemplateConfigDto;
}
