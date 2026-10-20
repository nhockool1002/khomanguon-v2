import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import {
  API_CLIENT_KEY_HEADER,
  findActiveApiClient,
} from '../../common/api-client.util';

// Xác nhận request tới từ đúng extension đã phát hành (ApiClient), KHÔNG xác thực user — luôn
// dùng chung với JwtAuthGuard (JwtAuthGuard đứng trước để request.user có trước khi vào đây không
// bắt buộc, 2 guard độc lập). Xem comment model ApiClient trong schema.prisma về việc key này
// không phải bí mật tuyệt đối. AuthController dùng cùng findActiveApiClient() nhưng không bắt
// buộc (login/refresh vẫn chạy được không cần header này, chỉ đổi cách trả refreshToken).
@Injectable()
export class ApiClientGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawKey = request.headers[API_CLIENT_KEY_HEADER];
    if (!rawKey) {
      throw new UnauthorizedException('Thiếu extension key');
    }

    const client = await findActiveApiClient(this.prisma, rawKey);
    if (!client) {
      throw new UnauthorizedException('Extension key không hợp lệ');
    }

    // Không await — cập nhật lastUsedAt là thông tin phụ trợ (để Admin biết client còn hoạt động
    // hay không), không được làm chậm hoặc làm fail request chính nếu write lỗi.
    void this.prisma.apiClient
      .update({ where: { id: client.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});

    return true;
  }
}
