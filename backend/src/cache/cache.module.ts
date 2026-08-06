import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { HttpCacheInterceptor } from './http-cache.interceptor';
import { FrontendRevalidateService } from './frontend-revalidate.service';
import { CacheController } from './cache.controller';
import { AuthModule } from '../auth/auth.module';

// @Global() giống RolesModule — mọi module khác (posts, categories, menus, widgets, settings,
// roles) cần CacheService để gọi invalidatePrefix() sau khi ghi dữ liệu, và cần
// HttpCacheInterceptor để @UseInterceptors() trên route GET công khai, mà không phải import lại
// CacheModule ở từng nơi.
@Global()
@Module({
  imports: [AuthModule],
  controllers: [CacheController],
  providers: [CacheService, HttpCacheInterceptor, FrontendRevalidateService],
  exports: [CacheService, HttpCacheInterceptor, FrontendRevalidateService],
})
export class CacheModule {}
