import { IsIn } from 'class-validator';

// Chỉ cho chuyển PENDING -> RESOLVED — đủ nhu cầu hiện tại, không cần mở lại feedback đã xử lý
// (giống hệt UpdateLinkReportStatusDto).
export class UpdateFeedbackStatusDto {
  @IsIn(['RESOLVED'])
  status: 'RESOLVED';
}
