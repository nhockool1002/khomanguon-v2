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
//
// Cache-Control (PLAN.md 4.2, Cloudflare Edge cache): mọi route đánh dấu @Cacheable đều là GET công
// khai, response giống hệt nhau cho mọi người xem (không có dữ liệu riêng theo user — xem chỗ dùng
// @Cacheable trong posts/categories/tags/menus/widgets/roles/site-settings controller, không route
// nào đọc @CurrentUser). Nên an toàn set "public, s-maxage" bằng đúng ttlSeconds đã cấu hình — CDN
// đứng trước domain api. (Cloudflare bật proxy theo Deploy_Checklist.md) hoặc bất kỳ proxy/browser
// nào tôn trọng Cache-Control đều có thể phục vụ thẳng từ edge, khỏi phải vào tới Node/Redis.
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
    // Mọi route @Cacheable đều dành cho khách công khai (không đọc @CurrentUser — xem comment trên).
    // Request có Authorization là admin tự đọc lại dữ liệu vừa ghi (vd trang Cài đặt chung load lại
    // sau khi Lưu) — nếu vẫn cache/set Cache-Control public như khách thường, CDN (Cloudflare) lẫn
    // Redis sẽ trả bản CŨ tới 300s dù DB đã cập nhật đúng, admin thấy "lưu xong reload lại mất tick".
    // Bỏ qua toàn bộ cache (đọc thẳng DB + không set Cache-Control) khi có Authorization.
    if (request.headers.authorization) return next.handle();

    const response = context.switchToHttp().getResponse<Response>();
    // stale-while-revalidate gấp đôi ttl — cho phép CDN trả bản cũ ngay lập tức trong lúc âm thầm
    // lấy bản mới, tránh 1 request "xui" phải chờ origin ngay lúc cache vừa hết hạn.
    response.setHeader(
      'Cache-Control',
      `public, s-maxage=${options.ttlSeconds}, stale-while-revalidate=${options.ttlSeconds * 2}`,
    );

    const key = `${options.namespace}:${request.originalUrl}`;
    const cached = await this.cache.get(key);
    if (cached !== null) {
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
