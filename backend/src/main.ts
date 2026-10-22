import { mkdirSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(cookieParser());

  // Backend luôn chạy sau reverse proxy (aaPanel/nginx production, hoặc Docker Compose local) —
  // không set trust proxy thì req.ip/@Ip() trả về IP nội bộ của proxy thay vì IP client thật, làm
  // sai mọi cơ chế dựa theo IP (DownloadRateLimitGuard, DownloadEvent.ipAddress, PostViewTracker...).
  app.set('trust proxy', 1);

  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  // maxAge/immutable: an toàn vì mọi file trong đây đặt tên theo randomUUID (uploads.controller.ts)
  // hoặc key theo ngày (dated-upload.util.ts) — không bao giờ ghi đè cùng tên, nên cache dài hạn ở
  // CDN/Cloudflare edge (PLAN.md 4.2) không bao giờ trả nhầm file cũ.
  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads/',
    maxAge: '1y',
    immutable: true,
  });

  // ALLOWED_ORIGINS: danh sách phân cách bởi dấu phẩy — cho phép thêm origin khác ngoài
  // FRONTEND_URL (URL Preview Deployment của Vercel đổi subdomain mỗi lần, hoặc
  // chrome-extension://<id> cho K-Extension) mà không phải mở CORS cho mọi domain.
  // Luôn cộng dồn với FRONTEND_URL (không thay thế) — đặt ALLOWED_ORIGINS chỉ để thêm origin
  // bổ sung, tránh lặp lại lỗi set ALLOWED_ORIGINS=chrome-extension://... làm mất luôn domain
  // production khỏi danh sách cho phép và sập CORS của web.
  const allowedOrigins = [
    ...(process.env.ALLOWED_ORIGINS ?? '').split(','),
    process.env.FRONTEND_URL ?? 'http://localhost:3000',
  ]
    .map((origin) => origin.trim())
    .filter(
      (origin, index, self) =>
        origin.length > 0 && self.indexOf(origin) === index,
    );

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Request không có Origin (server-to-server, health check, curl) — luôn cho qua.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} không được phép bởi CORS`), false);
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
