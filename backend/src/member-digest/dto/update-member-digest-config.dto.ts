import { Type } from 'class-transformer';
import { IsBoolean, IsInt, Max, Min, ValidateNested } from 'class-validator';
import { MailTemplateConfigDto } from '../../mail/dto/update-mail-templates.dto';

export class UpdateMemberDigestConfigDto {
  @IsBoolean()
  enabled: boolean;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsInt()
  @Min(0)
  @Max(23)
  hour: number;

  @IsInt()
  @Min(0)
  @Max(59)
  minute: number;

  @ValidateNested()
  @Type(() => MailTemplateConfigDto)
  template: MailTemplateConfigDto;
}
