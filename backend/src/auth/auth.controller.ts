import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { RegisterSource } from '@prisma/client';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { PublicRateLimitGuard } from '../common/rate-limit/public-rate-limit.guard';
import { RateLimitKey } from '../common/rate-limit/rate-limit-key.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  API_CLIENT_KEY_HEADER,
  findActiveApiClient,
} from '../common/api-client.util';

interface AuthUser {
  id: string;
  email: string;
}

const REFRESH_COOKIE_NAME = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // true khi request mang x-extension-key hợp lệ (K-Extension) — cookie refresh_token (httpOnly,
  // SameSite=None) thường KHÔNG tới được iframe K-Extension vì nó luôn nhúng trong 1 site thứ ba
  // bất kỳ, bị Chrome coi là cookie bên thứ ba và chặn. login()/refresh()/logout() dùng cờ này để
  // CHỈ CỘNG THÊM đường refreshToken qua JSON body cho đúng client đã định danh — web frontend
  // không gửi header này nên hành vi/bảo mật hiện tại (refresh token chỉ nằm trong cookie httpOnly,
  // JS trên web không đọc được, chống XSS đánh cắp token) giữ nguyên 100%.
  private async isExtensionClient(req: Request): Promise<boolean> {
    const client = await findActiveApiClient(
      this.prisma,
      req.headers[API_CLIENT_KEY_HEADER],
    );
    return !!client;
  }

  private setRefreshCookie(
    res: Response,
    refreshToken: string,
    expiresAt: Date,
  ) {
    // Production: frontend (Vercel) và backend (aaPanel) nằm ở domain khác nhau — cookie
    // cross-site bắt buộc `SameSite=None; Secure`, nếu không trình duyệt sẽ không gửi cookie
    // kèm request /auth/refresh, silent refresh sẽ âm thầm fail. Dev vẫn dùng `Lax` (không cần
    // Secure) vì http://localhost không có HTTPS.
    const isProd = this.config.get('NODE_ENV') === 'production';
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
      path: '/auth',
      expires: expiresAt,
    });
  }

  @UseGuards(PublicRateLimitGuard)
  @RateLimitKey('register')
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const isExtension = await this.isExtensionClient(req);
    const { user, tokens } = await this.authService.register(
      dto,
      isExtension ? RegisterSource.EXTENSION : RegisterSource.WEB,
    );
    this.setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
    const extra = isExtension ? { refreshToken: tokens.refreshToken } : {};
    return { user, accessToken: tokens.accessToken, ...extra };
  }

  @UseGuards(PublicRateLimitGuard)
  @RateLimitKey('login')
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.authService.login(
      dto,
      req.headers['user-agent'],
      req.ip,
    );
    this.setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
    const extra = (await this.isExtensionClient(req))
      ? { refreshToken: tokens.refreshToken }
      : {};
    return { user, accessToken: tokens.accessToken, ...extra };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieToken = (req.cookies as Record<string, string>)?.[
      REFRESH_COOKIE_NAME
    ];
    // Fallback qua body CHỈ áp dụng khi không có cookie VÀ request tới từ client đã định danh
    // (xem isExtensionClient) — web frontend luôn có cookie nên nhánh này chỉ chạy cho extension.
    const rawRefreshToken =
      cookieToken ||
      (dto.refreshToken && (await this.isExtensionClient(req))
        ? dto.refreshToken
        : null);
    if (!rawRefreshToken) {
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' });
      return { accessToken: null };
    }
    const { user, tokens } = await this.authService.refresh(
      rawRefreshToken,
      req.headers['user-agent'],
    );
    this.setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
    const extra = (await this.isExtensionClient(req))
      ? { refreshToken: tokens.refreshToken }
      : {};
    return { user, accessToken: tokens.accessToken, ...extra };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieToken = (req.cookies as Record<string, string>)?.[
      REFRESH_COOKIE_NAME
    ];
    await this.authService.logout(cookieToken || dto.refreshToken);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' });
  }

  @UseGuards(PublicRateLimitGuard)
  @RateLimitKey('forgotPassword')
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return {
      message:
        'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi link đặt lại mật khẩu.',
    };
  }

  @UseGuards(PublicRateLimitGuard)
  @RateLimitKey('resetPassword')
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Đặt lại mật khẩu thành công, vui lòng đăng nhập lại.' };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
    return { message: 'Xác minh email thành công.' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@CurrentUser() user: AuthUser) {
    await this.authService.resendVerification(user.id);
    return { message: 'Đã gửi lại email xác minh.' };
  }
}
