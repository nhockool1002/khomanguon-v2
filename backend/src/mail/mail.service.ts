import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createTransport, Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from '../common/secret-crypto.util';
import {
  DEFAULT_MAIL_TEMPLATES,
  MAIL_TEMPLATES_KEY,
  renderMailTemplate,
  type MailTemplates,
} from './mail-templates.types';
import type { UpdateMailTemplatesDto } from './dto/update-mail-templates.dto';

interface SendMailInput {
  to: string | string[];
  subject: string;
  html: string;
}

function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString('vi-VN');
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
    // Bắt buộc từ admin@khomanguon.org (mặc định) — env MAIL_FROM chỉ nên dùng để đổi khi cần thiết
    // thật sự (vd chưa xác thực domain khomanguon.org tại Mailjet), không phải để dùng địa chỉ khác.
    this.from =
      this.config.get<string>('MAIL_FROM') ??
      'khomanguon <admin@khomanguon.org>';
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
      this.logger.log(
        `[DEV MAIL] to=${Array.isArray(to) ? to.join(', ') : to} subject="${subject}"\n${html}`,
      );
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

  async sendPasswordResetEmail(
    to: string,
    displayName: string,
    resetUrl: string,
  ): Promise<void> {
    const templates = await this.getTemplates();
    const { subject, html } = renderMailTemplate(templates.passwordReset, {
      displayName,
      resetUrl,
      timestamp: formatTimestamp(new Date()),
    });
    await this.send({ to, subject, html });
  }

  // ───────────────────────── Template thông báo Admin ─────────────────────────

  async getTemplates(): Promise<MailTemplates> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: MAIL_TEMPLATES_KEY },
    });
    if (!row) return DEFAULT_MAIL_TEMPLATES;
    return {
      ...DEFAULT_MAIL_TEMPLATES,
      ...(row.value as Partial<MailTemplates>),
    };
  }

  async updateTemplates(dto: UpdateMailTemplatesDto): Promise<MailTemplates> {
    const current = await this.getTemplates();
    const next: MailTemplates = {
      ...current,
      ...(dto.notifyEmail !== undefined && { notifyEmail: dto.notifyEmail }),
      ...(dto.topupSuccess !== undefined && { topupSuccess: dto.topupSuccess }),
      ...(dto.downloadUnlock !== undefined && {
        downloadUnlock: dto.downloadUnlock,
      }),
      ...(dto.passwordReset !== undefined && {
        passwordReset: dto.passwordReset,
      }),
    };
    await this.prisma.siteSetting.upsert({
      where: { key: MAIL_TEMPLATES_KEY },
      update: { value: toJsonValue(next) },
      create: { key: MAIL_TEMPLATES_KEY, value: toJsonValue(next) },
    });
    return next;
  }

  // Gửi mail thông báo (KHÔNG throw ra ngoài) — đây là side-effect phụ của luồng nạp tiền/tải file,
  // lỗi gửi mail (Mailjet down...) không được làm hỏng luồng chính. Người nhận LUÔN gồm cả
  // notifyEmail (Admin, để trống thì bỏ qua phần này) VÀ userEmail (chính user vừa nạp/tải, dùng
  // như email xác nhận giao dịch — luôn gửi, không phụ thuộc notifyEmail có cấu hình hay không).
  private async sendNotification(
    kind: 'topupSuccess' | 'downloadUnlock',
    vars: Record<string, string>,
    userEmail: string,
  ): Promise<void> {
    try {
      const templates = await this.getTemplates();
      const recipients = [
        ...new Set([templates.notifyEmail, userEmail].filter(Boolean)),
      ];
      if (recipients.length === 0) return;
      const { subject, html } = renderMailTemplate(templates[kind], {
        timestamp: formatTimestamp(new Date()),
        ...vars,
      });
      await this.send({ to: recipients, subject, html });
    } catch (err) {
      this.logger.warn(
        `Gửi mail thông báo "${kind}" thất bại: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async sendTopupSuccessNotification(
    vars: {
      displayName: string;
      amountVnd: string;
      paymentMethod: string;
      transactionCode: string;
    },
    userEmail: string,
  ): Promise<void> {
    await this.sendNotification('topupSuccess', vars, userEmail);
  }

  async sendDownloadUnlockNotification(
    vars: {
      displayName: string;
      postTitle: string;
      fileName: string;
      priceP: string;
    },
    userEmail: string,
  ): Promise<void> {
    await this.sendNotification('downloadUnlock', vars, userEmail);
  }

  // Nút "Gửi thử" ở trang Admin — dùng dữ liệu mẫu, gửi đúng cả 2 người nhận thật (notifyEmail +
  // email của chính admin đang bấm nút) để kiểm chứng đúng logic 2 người nhận của luồng thật. Trả
  // {success,message} thay vì throw (khớp pattern testApiConnection() của sepay.service.ts) để FE
  // hiện lỗi thật thay vì 500 chung chung.
  // passwordReset khác 2 kind còn lại — gửi CHO USER, không liên quan notifyEmail của Admin — nên
  // chỉ gửi tới testerEmail (chính admin đang bấm nút), resetUrl là link mẫu (không sinh token thật).
  async sendTestNotification(
    kind: 'topupSuccess' | 'downloadUnlock' | 'passwordReset',
    testerEmail: string,
  ): Promise<{ success: boolean; message: string }> {
    const templates = await this.getTemplates();
    const recipients =
      kind === 'passwordReset'
        ? [testerEmail]
        : [...new Set([templates.notifyEmail, testerEmail].filter(Boolean))];
    if (recipients.length === 0) {
      return {
        success: false,
        message:
          'Chưa cấu hình "Email nhận thông báo" — nhập rồi lưu lại trước khi gửi thử.',
      };
    }
    const sampleVars: Record<string, string> =
      kind === 'topupSuccess'
        ? {
            displayName: 'demo_user',
            amountVnd: '50,000',
            paymentMethod: 'Vietcombank',
            transactionCode: 'GD123456',
          }
        : kind === 'downloadUnlock'
          ? {
              displayName: 'demo_user',
              postTitle: 'Bài viết mẫu',
              fileName: 'demo.zip',
              priceP: '50',
            }
          : {
              displayName: 'demo_user',
              resetUrl: `${this.config.get<string>('FRONTEND_URL')}/dat-lai-mat-khau?token=demo-token`,
            };
    const { subject, html } = renderMailTemplate(templates[kind], {
      timestamp: formatTimestamp(new Date()),
      ...sampleVars,
    });
    try {
      await this.send({ to: recipients, subject, html });
      return {
        success: true,
        message: `Đã gửi email thử tới ${recipients.join(', ')}.`,
      };
    } catch (err) {
      return {
        success: false,
        message: `Gửi thất bại: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
