import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Backend (aaPanel) và frontend (Vercel) chạy tách domain — không thể revalidatePath() in-process
// như 1 app Next.js độc lập. Thay vào đó gọi webhook nội bộ frontend/src/app/api/revalidate/
// route.ts qua HTTP, xác thực bằng secret dùng chung (REVALIDATE_SECRET) để không ai purge cache
// Next.js từ bên ngoài. Best-effort: lỗi ở bước này không được làm hỏng việc xoá Redis cache (xem
// CacheController) — báo lại "false" để FE hiện đúng trạng thái thay vì throw.
@Injectable()
export class FrontendRevalidateService {
  private readonly logger = new Logger(FrontendRevalidateService.name);

  constructor(private readonly config: ConfigService) {}

  async revalidateAll(): Promise<boolean> {
    // FRONTEND_URL dùng cho CORS phải là domain public trình duyệt thấy (vd localhost:3000ở
    // dev) — nhưng gọi HTTP server-to-server từ container backend thì "localhost:3000" trỏ vào
    // chính container backend, không tới được frontend. FRONTEND_INTERNAL_URL cho phép override
    // riêng cho lượt gọi này (dev: "http://frontend:3000" qua Docker network); bỏ trống thì dùng
    // luôn FRONTEND_URL — đúng cho production vì backend (aaPanel) và frontend (Vercel) gọi nhau
    // qua domain public thật.
    const frontendUrl =
      this.config.get<string>('FRONTEND_INTERNAL_URL') ??
      this.config.get<string>('FRONTEND_URL');
    const secret = this.config.get<string>('REVALIDATE_SECRET');
    if (!frontendUrl || !secret) {
      this.logger.warn(
        'Thiếu FRONTEND_URL hoặc REVALIDATE_SECRET — bỏ qua bước revalidate frontend.',
      );
      return false;
    }

    try {
      const res = await fetch(
        `${frontendUrl.replace(/\/$/, '')}/api/revalidate`,
        {
          method: 'POST',
          headers: { 'x-revalidate-secret': secret },
        },
      );
      return res.ok;
    } catch (err) {
      this.logger.warn(
        `Gọi webhook revalidate frontend thất bại: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
