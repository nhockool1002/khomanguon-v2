import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLinkReportDto {
  @IsString()
  downloadLinkId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
