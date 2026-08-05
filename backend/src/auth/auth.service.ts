import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UserActivityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RolesService } from '../roles/roles.service';
import { UserActivityService } from '../user-activity/user-activity.service';
import { RecaptchaService } from '../recaptcha/recaptcha.service';
import { generateOpaqueToken, hashToken } from '../common/token.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly roles: RolesService,
    private readonly userActivity: UserActivityService,
    private readonly recaptcha: RecaptchaService,
  ) {}

  private toPublicUser(user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    emailVerifiedAt: Date | null;
  }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerifiedAt !== null,
    };
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    if (!(await this.recaptcha.verify(dto.recaptchaToken))) {
      throw new BadRequestException(
        'Xác minh reCAPTCHA thất bại — vui lòng thử lại.',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email này đã được đăng ký');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        wallet: { create: { balance: 0 } },
      },
    });
    await this.roles.assignDefaultRole(user.id);
    await this.sendVerificationEmail(user.id, user.email, user.displayName);

    const tokens = await this.issueTokens(user.id);
    return { user: this.toPublicUser(user), tokens };
  }

  async login(
    dto: LoginDto,
    userAgent?: string,
    ip?: string,
  ): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    if (!(await this.recaptcha.verify(dto.recaptchaToken))) {
      throw new BadRequestException(
        'Xác minh reCAPTCHA thất bại — vui lòng thử lại.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (user.status === 'BANNED') {
      throw new UnauthorizedException('Tài khoản đã bị khoá');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new UnauthorizedException(
        `Tài khoản tạm khoá do đăng nhập sai nhiều lần — thử lại sau ${minutesLeft} phút`,
      );
    }

    const passwordOk = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      const lockedUntil =
        failedLoginAttempts >= MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOCK_DURATION_MS)
          : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: lockedUntil ? 0 : failedLoginAttempts,
          lockedUntil,
        },
      });
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const tokens = await this.issueTokens(user.id, userAgent);
    void this.userActivity.log(user.id, UserActivityType.LOGIN, undefined, ip);
    return { user: this.toPublicUser(user), tokens };
  }

  async issueTokens(userId: string, userAgent?: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: (this.config.get<string>('JWT_ACCESS_TTL') ??
          '15m') as JwtSignOptions['expiresIn'],
      },
    );

    const refreshTtlDays = Number(
      this.config.get('JWT_REFRESH_TTL_DAYS') ?? 30,
    );
    const refreshToken = generateOpaqueToken();
    const refreshExpiresAt = new Date(
      Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000,
    );
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        userAgent,
        expiresAt: refreshExpiresAt,
      },
    });

    return { accessToken, refreshToken, refreshExpiresAt };
  }

  async refresh(
    rawRefreshToken: string,
    userAgent?: string,
  ): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const tokenHash = hashToken(rawRefreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !existing ||
      existing.revokedAt !== null ||
      existing.expiresAt < new Date()
    ) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
      );
    }

    if (existing.user.status === 'BANNED') {
      throw new UnauthorizedException('Tài khoản đã bị khoá');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(existing.userId, userAgent);
    return { user: this.toPublicUser(existing.user), tokens };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email đã được xác minh trước đó');
    }
    await this.sendVerificationEmail(user.id, user.email, user.displayName);
  }

  async sendVerificationEmail(
    userId: string,
    email: string,
    displayName: string,
  ): Promise<void> {
    const rawToken = generateOpaqueToken();
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
      },
    });
    const verifyUrl = `${this.config.get<string>('FRONTEND_URL')}/xac-minh-email?token=${rawToken}`;
    await this.mail.sendVerificationEmail(email, displayName, verifyUrl);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });
    if (
      !record ||
      record.consumedAt !== null ||
      record.expiresAt < new Date()
    ) {
      throw new BadRequestException(
        'Link xác minh không hợp lệ hoặc đã hết hạn',
      );
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
    ]);
    // Nâng UNVERIFIED -> MEMBER sau khi transaction commit — không gộp vào $transaction ở trên vì
    // upgradeAfterVerification tự có transaction riêng (2 bước xoá/tạo UserRole).
    await this.roles.upgradeAfterVerification(record.userId);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Luôn trả về thành công ở tầng controller dù user có tồn tại hay không — tránh lộ email nào đã đăng ký.
    if (!user) return;

    const rawToken = generateOpaqueToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    const resetUrl = `${this.config.get<string>('FRONTEND_URL')}/dat-lai-mat-khau?token=${rawToken}`;
    await this.mail.sendPasswordResetEmail(email, user.displayName, resetUrl);
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (
      !record ||
      record.consumedAt !== null ||
      record.expiresAt < new Date()
    ) {
      throw new BadRequestException(
        'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
      );
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      // Đổi mật khẩu xong buộc đăng nhập lại ở mọi thiết bị — thu hồi toàn bộ refresh token đang hoạt động.
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
