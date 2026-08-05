import { Global, Module } from '@nestjs/common';
import { UserActivityService } from './user-activity.service';

// @Global() — được gọi từ nhiều module không liên quan nhau (auth, posts, sepay, users), chỉ phụ
// thuộc PrismaModule (đã @Global() sẵn) nên không có nguy cơ circular dependency.
@Global()
@Module({
  providers: [UserActivityService],
  exports: [UserActivityService],
})
export class UserActivityModule {}
