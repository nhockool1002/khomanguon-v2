import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TrackVisitDto {
  @IsString()
  @MaxLength(500)
  path: string;

  // document.referrer phía trình duyệt — rỗng/thiếu nghĩa là truy cập trực tiếp hoặc trình duyệt
  // không gửi (nhiều mobile app/trình duyệt chặn vì privacy), xem analytics.service.ts.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  referrer?: string;
}
