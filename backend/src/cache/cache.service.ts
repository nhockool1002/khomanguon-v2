import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// Tiền tố riêng cho mọi key do tính năng cache này tạo ra — cho phép FLUSHDB có chọn lọc (SCAN +
// xoá theo tiền tố) thay vì FLUSHDB toàn bộ, phòng khi sau này Redis dùng chung cho việc khác
// (session, BullMQ...) mà không muốn "Xoá cache" cuốn theo dữ liệu đó.
const KEY_PREFIX = 'kmg:cache:';

// Object cache kiểu WP-Rocket/LiteSpeed: cache-aside qua Redis cho các API GET công khai tốn kém
// (danh sách bài viết, danh mục, menu, widget...) — xem HttpCacheInterceptor để biết cách áp dụng
// theo route. Tự bỏ qua (fail-open) khi Redis lỗi để không làm sập API vì sự cố cache.
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis(config.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
    });
    this.redis.on('error', (err) => {
      this.logger.warn(`Redis lỗi kết nối: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(KEY_PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      this.logger.warn(`get("${key}") lỗi: ${(err as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(
        KEY_PREFIX + key,
        JSON.stringify(value),
        'EX',
        ttlSeconds,
      );
    } catch (err) {
      this.logger.warn(`set("${key}") lỗi: ${(err as Error).message}`);
    }
  }

  // Xoá toàn bộ key thuộc 1 namespace (vd "posts") — gọi ở service sau mỗi lần ghi (create/
  // update/xoá/reorder) để object cache không bao giờ trả dữ liệu cũ quá TTL đã set.
  async invalidatePrefix(namespace: string): Promise<void> {
    try {
      const pattern = `${KEY_PREFIX}${namespace}:*`;
      const keys = await this.scanKeys(pattern);
      if (keys.length > 0) await this.redis.del(...keys);
    } catch (err) {
      this.logger.warn(
        `invalidatePrefix("${namespace}") lỗi: ${(err as Error).message}`,
      );
    }
  }

  // Nút "Xoá cache" trên topbar — dọn sạch mọi key do tính năng này tạo ra bất kể namespace.
  async clearAll(): Promise<number> {
    try {
      const keys = await this.scanKeys(`${KEY_PREFIX}*`);
      if (keys.length > 0) await this.redis.del(...keys);
      return keys.length;
    } catch (err) {
      this.logger.warn(`clearAll() lỗi: ${(err as Error).message}`);
      return 0;
    }
  }

  // SCAN thay vì KEYS — không block Redis dù có nhiều key, an toàn dùng ở production.
  private async scanKeys(pattern: string): Promise<string[]> {
    const found: string[] = [];
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        500,
      );
      cursor = next;
      found.push(...keys);
    } while (cursor !== '0');
    return found;
  }
}
