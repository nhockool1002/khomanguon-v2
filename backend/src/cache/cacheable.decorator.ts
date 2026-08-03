import { SetMetadata } from '@nestjs/common';

export const CACHEABLE_KEY = 'cacheable';

export interface CacheableOptions {
  namespace: string;
  ttlSeconds: number;
}

// Đánh dấu 1 route GET công khai là "cacheable" — HttpCacheInterceptor đọc metadata này để quyết
// định có cache response hay không. namespace dùng làm tiền tố key (vd "posts") để service liên
// quan gọi CacheService.invalidatePrefix(namespace) xoá đúng phạm vi khi nội dung thay đổi.
export const Cacheable = (namespace: string, ttlSeconds: number) =>
  SetMetadata(CACHEABLE_KEY, {
    namespace,
    ttlSeconds,
  } satisfies CacheableOptions);
