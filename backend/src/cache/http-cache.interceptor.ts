import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CACHEABLE_KEY, CacheableOptions } from './cacheable.decorator';
import { CacheService } from './cache.service';

// Cache toàn bộ response JSON của route GET đã đánh dấu @Cacheable — tương đương "object cache"
// của WP-Rocket/LiteSpeed cho các API đọc công khai (danh sách bài viết, danh mục, menu...).
// Key cache = "<namespace>:<path>?<query>" nên các biến thể query (category, page, sort...) của
// cùng 1 route không đụng cache của nhau; xoá cả namespace khi nội dung liên quan thay đổi (xem
// CacheService.invalidatePrefix, gọi từ service tương ứng sau mỗi lần ghi).
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cache: CacheService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const options = this.reflector.get<CacheableOptions | undefined>(
      CACHEABLE_KEY,
      context.getHandler(),
    );
    if (!options) return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    if (request.method !== 'GET') return next.handle();

    const key = `${options.namespace}:${request.originalUrl}`;
    const cached = await this.cache.get(key);
    if (cached !== null) {
      const response = context.switchToHttp().getResponse<Response>();
      response.setHeader('X-Cache', 'HIT');
      return of(cached);
    }

    return next.handle().pipe(
      tap((data: unknown) => {
        if (data !== undefined)
          void this.cache.set(key, data, options.ttlSeconds);
      }),
    );
  }
}
