import { SetMetadata } from '@nestjs/common';

export const SKIP_AUDIT_KEY = 'audit:skip';
export const FORCE_AUDIT_KEY = 'audit:force';

// Bỏ qua ghi audit tự động (AdminAuditInterceptor) cho route ĐÃ tự ghi audit chi tiết riêng trong
// service (gán/gỡ vai trò, điều chỉnh ví, admin-bypass link tải, thu hồi Subscription, duyệt/từ chối
// nạp quốc tế...) — tránh 2 dòng log cho cùng 1 thao tác.
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);

// Ép ghi audit cho route thao tác quản trị KHÔNG khai báo @Permissions (quyền kiểm tra bên trong
// service, vd PATCH /posts/:id phân biệt post.edit.own / post.edit.any theo chủ bài).
export const AuditAdminAction = () => SetMetadata(FORCE_AUDIT_KEY, true);
