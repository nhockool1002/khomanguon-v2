import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import type { AccessTokenPayload } from './jwt-auth.guard';

interface RequestWithUser extends Request {
  user?: { id: string; email: string };
}

// Gắn request.user nếu có access token hợp lệ, nhưng KHÔNG chặn request khi thiếu/hết hạn —
// dùng cho endpoint công khai cần biết "ai đang xem" khi có thể (vd like/likedByMe trên bình luận).
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;
    if (!token) return true;

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      request.user = { id: payload.sub, email: payload.email };
    } catch {
      // Token hỏng/hết hạn — coi như khách chưa đăng nhập, không chặn.
    }
    return true;
  }
}
