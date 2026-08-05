import { Global, Module } from '@nestjs/common';
import { PublicRateLimitService } from './public-rate-limit.service';
import { PublicRateLimitGuard } from './public-rate-limit.guard';

// @Global() — áp dụng cho route ở nhiều module không liên quan nhau (auth, posts, comments), chỉ
// phụ thuộc PrismaModule (đã @Global() sẵn) nên không có nguy cơ circular dependency.
@Global()
@Module({
  providers: [PublicRateLimitService, PublicRateLimitGuard],
  exports: [PublicRateLimitService, PublicRateLimitGuard],
})
export class RateLimitModule {}
