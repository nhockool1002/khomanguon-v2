import { IsIn } from 'class-validator';

// Chỉ cho chuyển PENDING -> RESOLVED — đủ nhu cầu hiện tại (UC25), không cần mở lại report đã xử lý.
export class UpdateLinkReportStatusDto {
  @IsIn(['RESOLVED'])
  status: 'RESOLVED';
}
