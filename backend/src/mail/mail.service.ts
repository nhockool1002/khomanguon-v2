import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from '../common/secret-crypto.util';

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

const MAILJET_SMTP_HOST = 'in-v3.mailjet.com';
const MAILJET_SMTP_PORT = 587;

// Không có SMTP_HOST cấu hình -> log email ra console thay vì gửi thật, đủ để
// test luồng đăng ký/quên mật khẩu ở local mà không cần tài khoản SMTP.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly envTransporter: Transporter | null;
  private readonly from: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.from =
      this.config.get<string>('MAIL_FROM') ??
      'khomanguon <no-reply@khomanguon.local>';
    const host = this.config.get<string>('SMTP_HOST');

    this.envTransporter = host
      ? createTransport({
          host,
          port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
          auth: {
            user: this.config.get<string>('SMTP_USER'),
            pass: this.config.get<string>('SMTP_PASS'),
          },
        })
      : null;
  }

  // Ưu tiên StorageProvider loại MAILJET (cấu hình qua trang Admin > Cài đặt Storage) — Mailjet hỗ
  // trợ gửi qua SMTP relay chuẩn (API Key làm user, Secret Key làm pass), nên tái dùng thẳng
  // nodemailer hiện có thay vì cài thêm SDK riêng. Không có provider MAILJET nào -> rơi về
  // SMTP_HOST cấu hình qua env (giữ nguyên hành vi cũ).
  private async getTransporter(): Promise<Transporter | null> {
    const mailjetProvider = await this.prisma.storageProvider.findFirst({
      where: { type: 'MAILJET' },
      orderBy: { isDefault: 'desc' },
    });
    if (mailjetProvider) {
      return createTransport({
        host: MAILJET_SMTP_HOST,
        port: MAILJET_SMTP_PORT,
        auth: {
          user: mailjetProvider.accessKeyId,
          pass: decryptSecret(mailjetProvider.secretAccessKeyEncrypted),
        },
      });
    }
    return this.envTransporter;
  }

  async send({ to, subject, html }: SendMailInput): Promise<void> {
    const transporter = await this.getTransporter();
    if (!transporter) {
      this.logger.log(`[DEV MAIL] to=${to} subject="${subject}"\n${html}`);
      return;
    }
    await transporter.sendMail({ from: this.from, to, subject, html });
  }

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    await this.send({
      to,
      subject: 'Xác minh email khomanguon',
      html: `<p>Chào bạn,</p><p>Bấm vào link sau để xác minh email (hết hạn sau 24 giờ):</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.send({
      to,
      subject: 'Đặt lại mật khẩu khomanguon',
      html: `<p>Chào bạn,</p><p>Bấm vào link sau để đặt lại mật khẩu (hết hạn sau 15 phút, chỉ dùng được 1 lần):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>`,
    });
  }
}
