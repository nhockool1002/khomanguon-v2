import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';

// @Global() giống UserActivityModule — được gọi từ nhiều module không liên quan nhau (users,
// wallet, storage-providers), chỉ phụ thuộc PrismaModule (đã @Global() sẵn).
@Global()
@Module({
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
