import { createHmac } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PostStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { UpdateNewsletterConfigDto } from './dto/update-newsletter-config.dto';
import {
  DEFAULT_NEWSLETTER_CONFIG,
  NEWSLETTER_CONFIG_KEY,
  type NewsletterConfig,
} from './newsletter-config.types';

function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const digestPostSelect = {
  title: true,
  slug: true,
  excerpt: true,
} satisfies Prisma.PostSelect;

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  // ───────────────────────── Cấu hình lịch gửi ─────────────────────────

  async getConfig(): Promise<NewsletterConfig> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: NEWSLETTER_CONFIG_KEY },
    });
    if (!row) return DEFAULT_NEWSLETTER_CONFIG;
    return {
      ...DEFAULT_NEWSLETTER_CONFIG,
      ...(row.value as Partial<NewsletterConfig>),
    };
  }

  async updateConfig(
    dto: UpdateNewsletterConfigDto,
  ): Promise<NewsletterConfig> {
    const current = await this.getConfig();
    const next: NewsletterConfig = { ...current, ...dto };
    await this.prisma.siteSetting.upsert({
      where: { key: NEWSLETTER_CONFIG_KEY },
      update: { value: toJsonValue(next) },
      create: { key: NEWSLETTER_CONFIG_KEY, value: toJsonValue(next) },
    });
    return next;
  }

  private async setLastSentAt(date: Date): Promise<void> {
    const current = await this.getConfig();
    const next: NewsletterConfig = {
      ...current,
      lastSentAt: date.toISOString(),
    };
    await this.prisma.siteSetting.upsert({
      where: { key: NEWSLETTER_CONFIG_KEY },
      update: { value: toJsonValue(next) },
      create: { key: NEWSLETTER_CONFIG_KEY, value: toJsonValue(next) },
    });
  }

  // ───────────────────────── Đăng ký / huỷ đăng ký ─────────────────────────

  // Idempotent — đăng ký lại email đã đăng ký (còn hiệu lực) không lỗi, không tạo trùng (email
  // unique). Đã huỷ trước đó thì đăng ký lại = xoá unsubscribedAt, không tạo record mới.
  async subscribe(email: string): Promise<{ ok: true }> {
    const normalized = email.trim().toLowerCase();
    await this.prisma.newsletterSubscriber.upsert({
      where: { email: normalized },
      update: { unsubscribedAt: null },
      create: { email: normalized },
    });
    return { ok: true };
  }

  // Token KHÔNG lưu trong DB — ký bằng HMAC-SHA256(JWT_ACCESS_SECRET, subscriberId), verify bằng
  // cách tính lại rồi so sánh (constant-time không cần thiết ở đây, mức rủi ro thấp — huỷ nhầm 1
  // email không phải sự cố bảo mật nghiêm trọng, khác token xác thực tài khoản/đặt lại mật khẩu).
  // Nhờ vậy link "Huỷ đăng ký" DÙNG LẠI được ở mọi kỳ digest, không cần token one-time.
  signUnsubscribeToken(subscriberId: string): string {
    const secret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    return createHmac('sha256', secret).update(subscriberId).digest('hex');
  }

  async unsubscribe(
    subscriberId: string,
    token: string,
  ): Promise<{ ok: true }> {
    if (token !== this.signUnsubscribeToken(subscriberId)) {
      throw new BadRequestException('Link huỷ đăng ký không hợp lệ');
    }
    await this.prisma.newsletterSubscriber.updateMany({
      where: { id: subscriberId },
      data: { unsubscribedAt: new Date() },
    });
    return { ok: true };
  }

  async getSubscriberCount(): Promise<{ active: number; total: number }> {
    const [active, total] = await this.prisma.$transaction([
      this.prisma.newsletterSubscriber.count({
        where: { unsubscribedAt: null },
      }),
      this.prisma.newsletterSubscriber.count(),
    ]);
    return { active, total };
  }

  // ───────────────────────── Gửi bản tin ─────────────────────────

  // Dùng chung cho cron hàng tuần (newsletter-cron.service.ts) VÀ nút "Gửi ngay" ở trang Admin.
  // Không có bài mới kể từ lần gửi trước -> bỏ qua, không gửi digest rỗng làm phiền subscriber.
  async sendDigestNow(): Promise<{
    sent: number;
    postCount: number;
    skippedReason?: string;
  }> {
    const config = await this.getConfig();
    const since = config.lastSentAt
      ? new Date(config.lastSentAt)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const posts = await this.prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        publishedAt: { gt: since },
      },
      orderBy: { publishedAt: 'desc' },
      select: digestPostSelect,
      take: 20,
    });
    if (posts.length === 0) {
      return { sent: 0, postCount: 0, skippedReason: 'Không có bài viết mới' };
    }

    const subscribers = await this.prisma.newsletterSubscriber.findMany({
      where: { unsubscribedAt: null },
      select: { id: true, email: true },
    });
    if (subscribers.length === 0) {
      return {
        sent: 0,
        postCount: posts.length,
        skippedReason: 'Chưa có người đăng ký',
      };
    }

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? '';
    const subject = `Bản tin khomanguon.vn — ${posts.length} bài viết mới tuần này`;
    const postsHtml = posts
      .map(
        (p) => `<tr>
    <td style="padding:12px 0;border-bottom:1px solid #e4e4e7;">
      <a href="${frontendUrl}/bai-viet/${p.slug}" style="color:#1d3557;font-weight:600;text-decoration:none;">${p.title}</a>
      ${p.excerpt ? `<p style="margin:4px 0 0;color:#71717a;font-size:13px;">${p.excerpt}</p>` : ''}
    </td>
  </tr>`,
      )
      .join('\n');

    let sentCount = 0;
    // Tuần tự (không Promise.all) — chưa có rate-limit/batching cho gửi hàng loạt (mail.service.ts
    // send() gọi thẳng SMTP mỗi lần), tránh dí quá nhiều request cùng lúc vào Mailjet/SMTP provider.
    for (const subscriber of subscribers) {
      const unsubscribeUrl = `${frontendUrl}/newsletter/huy-dang-ky?id=${subscriber.id}&token=${this.signUnsubscribeToken(subscriber.id)}`;
      const html = `<p>Xin chào,</p>
<p>Tuần này khomanguon.vn có ${posts.length} bài viết mới:</p>
<table style="width:100%;border-collapse:collapse;">${postsHtml}</table>
<p style="margin-top:16px;font-size:12px;color:#a1a1aa;">
  Bạn nhận được email này vì đã đăng ký nhận bản tin tại khomanguon.vn.
  <a href="${unsubscribeUrl}" style="color:#a1a1aa;">Huỷ đăng ký</a>.
</p>`;
      try {
        await this.mailService.send({ to: subscriber.email, subject, html });
        sentCount++;
      } catch (err) {
        this.logger.warn(
          `Gửi newsletter tới ${subscriber.email} thất bại: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    await this.setLastSentAt(new Date());
    return { sent: sentCount, postCount: posts.length };
  }
}
