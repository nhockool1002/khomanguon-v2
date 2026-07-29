import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

// Không có SMTP_HOST cấu hình -> log email ra console thay vì gửi thật, đủ để
// test luồng đăng ký/quên mật khẩu ở local mà không cần tài khoản SMTP.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from =
      this.config.get<string>('MAIL_FROM') ??
      'khomanguon <no-reply@khomanguon.local>';
    const host = this.config.get<string>('SMTP_HOST');

    this.transporter = host
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

  async send({ to, subject, html }: SendMailInput): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[DEV MAIL] to=${to} subject="${subject}"\n${html}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, html });
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
