import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { AuthModule } from '../auth/auth.module';

// @Global() giống UserActivityModule — AuditLogService được gọi từ nhiều module không liên quan
// nhau (users, wallet, storage-providers), chỉ phụ thuộc PrismaModule (đã @Global() sẵn). Nhưng
// khác UserActivityModule (không có controller), AuditLogController dùng JwtAuthGuard nên vẫn
// phải import AuthModule — AuthModule không @Global(), mỗi module có controller cần guard này đều
// phải tự import (xem storage-providers.module.ts làm mẫu).
@Global()
@Module({
  imports: [AuthModule],
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
