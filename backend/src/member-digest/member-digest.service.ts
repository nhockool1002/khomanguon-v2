import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MemberDigestBatchStatus,
  MemberDigestRecipientStatus,
  MemberDigestTrigger,
  Prisma,
  PostStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  escapeMailText,
  renderMailTemplate,
} from '../mail/mail-templates.types';
import { UpdateMemberDigestConfigDto } from './dto/update-member-digest-config.dto';
import {
  DEFAULT_MEMBER_DIGEST_CONFIG,
  MEMBER_DIGEST_CONFIG_KEY,
  type MemberDigestConfig,
} from './member-digest-config.types';

function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString('vi-VN');
}

const digestPostSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
} satisfies Prisma.PostSelect;

type DigestPost = Prisma.PostGetPayload<{ select: typeof digestPostSelect }>;

interface DigestContent {
  newPosts: DigestPost[];
  mostViewed: DigestPost[];
  mostDownloaded: DigestPost[];
}

const NEW_POSTS_TAKE = 10;
const MOST_VIEWED_TAKE = 5;
const MOST_DOWNLOADED_TAKE = 5;
const MOST_VIEWED_WINDOW_DAYS = 90;
const DOWNLOADS_FALLBACK_WINDOW_DAYS = 90;
const NEW_POSTS_FALLBACK_WINDOW_DAYS = 7;
const CHUNK_SIZE = 20;

@Injectable()
export class MemberDigestService {
  private readonly logger = new Logger(MemberDigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  // ───────────────────────── Cấu hình ─────────────────────────

  async getConfig(): Promise<MemberDigestConfig> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: MEMBER_DIGEST_CONFIG_KEY },
    });
    if (!row) return DEFAULT_MEMBER_DIGEST_CONFIG;
    return {
      ...DEFAULT_MEMBER_DIGEST_CONFIG,
      ...(row.value as Partial<MemberDigestConfig>),
    };
  }

  async updateConfig(
    dto: UpdateMemberDigestConfigDto,
  ): Promise<MemberDigestConfig> {
    const current = await this.getConfig();
    const next: MemberDigestConfig = { ...current, ...dto };
    await this.prisma.siteSetting.upsert({
      where: { key: MEMBER_DIGEST_CONFIG_KEY },
      update: { value: toJsonValue(next) },
      create: { key: MEMBER_DIGEST_CONFIG_KEY, value: toJsonValue(next) },
    });
    return next;
  }

  private async setLastSentAt(date: Date): Promise<void> {
    const current = await this.getConfig();
    const next: MemberDigestConfig = {
      ...current,
      lastSentAt: date.toISOString(),
    };
    await this.prisma.siteSetting.upsert({
      where: { key: MEMBER_DIGEST_CONFIG_KEY },
      update: { value: toJsonValue(next) },
      create: { key: MEMBER_DIGEST_CONFIG_KEY, value: toJsonValue(next) },
    });
  }

  // "Đã kích hoạt tài khoản" = status ACTIVE (chưa bị khoá/ban) + emailVerifiedAt khác null
  // (đã xác minh email) + receiveDigestEmails chưa bị user tự tắt (xem users.service.ts
  // updateProfile(), cùng cơ chế opt-out với showPostPopup).
  private eligibleUserWhere(): Prisma.UserWhereInput {
    return {
      status: UserStatus.ACTIVE,
      emailVerifiedAt: { not: null },
      receiveDigestEmails: true,
    };
  }

  async getEligibleRecipientCount(): Promise<{ eligible: number }> {
    const eligible = await this.prisma.user.count({
      where: this.eligibleUserWhere(),
    });
    return { eligible };
  }

  // ───────────────────────── Chọn nội dung digest ─────────────────────────

  // Loại trùng bài đã xuất hiện ở nhóm trước (ưu tiên newPosts > mostViewed > mostDownloaded) —
  // không có ý nghĩa gì khi 1 bài xuất hiện 2 lần trong cùng 1 email.
  private async computeDigestContent(
    lastSentAt: string | null,
  ): Promise<DigestContent> {
    const newPostsSince = lastSentAt
      ? new Date(lastSentAt)
      : new Date(Date.now() - NEW_POSTS_FALLBACK_WINDOW_DAYS * 86_400_000);
    const downloadsSince = lastSentAt
      ? new Date(lastSentAt)
      : new Date(Date.now() - DOWNLOADS_FALLBACK_WINDOW_DAYS * 86_400_000);
    const mostViewedSince = new Date(
      Date.now() - MOST_VIEWED_WINDOW_DAYS * 86_400_000,
    );

    const newPosts = await this.prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        publishedAt: { gt: newPostsSince },
      },
      orderBy: { publishedAt: 'desc' },
      select: digestPostSelect,
      take: NEW_POSTS_TAKE,
    });
    const excludeIds = new Set(newPosts.map((p) => p.id));

    const mostViewedCandidates = await this.prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        publishedAt: { gt: mostViewedSince },
        id: { notIn: [...excludeIds] },
      },
      orderBy: { viewCount: 'desc' },
      select: digestPostSelect,
      take: MOST_VIEWED_TAKE,
    });
    mostViewedCandidates.forEach((p) => excludeIds.add(p.id));

    const mostDownloaded = await this.computeMostDownloaded(
      downloadsSince,
      excludeIds,
    );

    return {
      newPosts,
      mostViewed: mostViewedCandidates,
      mostDownloaded,
    };
  }

  // DownloadEvent chỉ có downloadLinkId (không có postId trực tiếp) — không có bảng log view theo
  // thời gian cho bài viết nên nhóm "xem nhiều" phải dùng Post.viewCount dồn (xem
  // post-view-tracker.service.ts), nhưng download thì có createdAt thật nên đếm theo khoảng thời
  // gian cho đúng nghĩa "tải nhiều GẦN ĐÂY".
  private async computeMostDownloaded(
    since: Date,
    excludeIds: Set<string>,
  ): Promise<DigestPost[]> {
    const grouped = await this.prisma.downloadEvent.groupBy({
      by: ['downloadLinkId'],
      where: { createdAt: { gt: since } },
      _count: { _all: true },
    });
    if (grouped.length === 0) return [];

    const links = await this.prisma.downloadLink.findMany({
      where: { id: { in: grouped.map((g) => g.downloadLinkId) } },
      select: { id: true, postId: true },
    });
    const linkToPost = new Map(links.map((l) => [l.id, l.postId]));

    const countByPost = new Map<string, number>();
    for (const g of grouped) {
      const postId = linkToPost.get(g.downloadLinkId);
      if (!postId || excludeIds.has(postId)) continue;
      countByPost.set(postId, (countByPost.get(postId) ?? 0) + g._count._all);
    }
    if (countByPost.size === 0) return [];

    const topPostIds = [...countByPost.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MOST_DOWNLOADED_TAKE)
      .map(([postId]) => postId);

    const posts = await this.prisma.post.findMany({
      where: { id: { in: topPostIds }, status: PostStatus.PUBLISHED },
      select: digestPostSelect,
    });
    // findMany không giữ thứ tự theo topPostIds — sắp lại theo đúng rank đã tính.
    const byId = new Map(posts.map((p) => [p.id, p]));
    return topPostIds
      .map((id) => byId.get(id))
      .filter((p): p is DigestPost => !!p);
  }

  // ───────────────────────── Render HTML ─────────────────────────

  private renderSection(title: string, posts: DigestPost[]): string {
    if (posts.length === 0) return '';
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? '';
    const rows = posts
      .map(
        (p) => `<tr>
    <td style="padding:12px 0;border-bottom:1px solid #e4e4e7;">
      <a href="${frontendUrl}/bai-viet/${p.slug}" style="color:#1d3557;font-weight:600;text-decoration:none;">${escapeMailText(p.title)}</a>
      ${p.excerpt ? `<p style="margin:4px 0 0;color:#71717a;font-size:13px;">${escapeMailText(p.excerpt)}</p>` : ''}
    </td>
  </tr>`,
      )
      .join('\n');
    return `<h3 style="margin:20px 0 8px;color:#1d3557;">${title}</h3>
<table style="width:100%;border-collapse:collapse;">${rows}</table>`;
  }

  private renderContentVars(content: DigestContent): Record<string, string> {
    return {
      newPostsHtml: this.renderSection('Bài viết mới', content.newPosts),
      mostViewedHtml: this.renderSection('Được xem nhiều', content.mostViewed),
      mostDownloadedHtml: this.renderSection(
        'Được tải nhiều',
        content.mostDownloaded,
      ),
    };
  }

  private sampleContent(): DigestContent {
    const sample = (suffix: string): DigestPost => ({
      id: `demo-${suffix}`,
      title: `Bài viết mẫu ${suffix}`,
      slug: `bai-viet-mau-${suffix}`,
      excerpt:
        'Nội dung mô tả ngắn cho bài viết mẫu dùng để xem thử giao diện email.',
    });
    return {
      newPosts: [sample('1'), sample('2')],
      mostViewed: [sample('3')],
      mostDownloaded: [sample('4')],
    };
  }

  // ───────────────────────── Tạo batch (hàng đợi) ─────────────────────────

  // Gọi từ cron (checkSchedule) hoặc nút "Gửi ngay" ở trang Admin. KHÔNG gửi mail trực tiếp ở đây
  // — chỉ tính nội dung 1 LẦN rồi lưu snapshot vào batch + tạo toàn bộ recipient PENDING, việc gửi
  // thật do processNextChunk() (cron riêng, chạy mỗi phút) đảm nhiệm để không dí hàng loạt email
  // vào SMTP trong 1 request. Lưu snapshot (thay vì tính lại lúc gửi) vì batch có thể mất tới vài
  // chục phút mới xử lý xong hết recipient — tính lại giữa chừng sẽ cho nội dung lệch nhau giữa các
  // recipient (bài mới xuất bản/viewCount đổi) và không còn "since" gốc để tính (lastSentAt đã bị
  // ghi đè ngay sau khi tạo batch, xem bên dưới).
  async createBatchIfDue(trigger: MemberDigestTrigger): Promise<{
    batchId: string | null;
    totalRecipients: number;
    skippedReason?: string;
  }> {
    const config = await this.getConfig();
    const content = await this.computeDigestContent(config.lastSentAt);
    if (
      content.newPosts.length === 0 &&
      content.mostViewed.length === 0 &&
      content.mostDownloaded.length === 0
    ) {
      return {
        batchId: null,
        totalRecipients: 0,
        skippedReason:
          'Không có nội dung nào để gửi (không có bài mới/xem nhiều/tải nhiều)',
      };
    }

    const recipients = await this.prisma.user.findMany({
      where: this.eligibleUserWhere(),
      select: { id: true, email: true },
    });
    if (recipients.length === 0) {
      return {
        batchId: null,
        totalRecipients: 0,
        skippedReason: 'Chưa có thành viên nào đủ điều kiện nhận',
      };
    }

    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.memberDigestBatch.create({
        data: {
          trigger,
          status: MemberDigestBatchStatus.PENDING,
          contentSnapshot: toJsonValue(content),
          newPostCount: content.newPosts.length,
          mostViewedCount: content.mostViewed.length,
          mostDownloadedCount: content.mostDownloaded.length,
          totalRecipients: recipients.length,
        },
      });
      await tx.memberDigestRecipient.createMany({
        data: recipients.map((r) => ({
          batchId: created.id,
          userId: r.id,
          email: r.email,
        })),
      });
      return created;
    });

    // Set NGAY lúc tạo batch (không đợi gửi xong hết) — chống tick phút sau của checkSchedule() tạo
    // batch trùng trong lúc batch này còn đang xử lý dần (mirror cơ chế dedup <24h của newsletter).
    await this.setLastSentAt(new Date());

    this.logger.log(
      `Tạo batch digest #${batch.id}: ${recipients.length} người nhận, ${content.newPosts.length} bài mới, ${content.mostViewed.length} bài xem nhiều, ${content.mostDownloaded.length} bài tải nhiều.`,
    );
    return { batchId: batch.id, totalRecipients: recipients.length };
  }

  // ───────────────────────── Xử lý hàng đợi (cron mỗi phút) ─────────────────────────

  // Tuần tự (không Promise.all) — cùng lý do newsletter.service.ts sendDigestNow(): tránh dí quá
  // nhiều request cùng lúc vào SMTP provider. Mỗi lần cron tick chỉ xử lý tối đa CHUNK_SIZE recipient
  // của batch CŨ NHẤT còn dang dở — batch lớn tự trải ra nhiều phút thay vì xử lý hết trong 1 lần.
  async processNextChunk(
    chunkSize = CHUNK_SIZE,
  ): Promise<{ processed: number }> {
    const batch = await this.prisma.memberDigestBatch.findFirst({
      where: {
        status: {
          in: [
            MemberDigestBatchStatus.PENDING,
            MemberDigestBatchStatus.RUNNING,
          ],
        },
      },
      orderBy: { startedAt: 'asc' },
    });
    if (!batch) return { processed: 0 };

    if (batch.status === MemberDigestBatchStatus.PENDING) {
      await this.prisma.memberDigestBatch.update({
        where: { id: batch.id },
        data: { status: MemberDigestBatchStatus.RUNNING },
      });
    }

    const pending = await this.prisma.memberDigestRecipient.findMany({
      where: { batchId: batch.id, status: MemberDigestRecipientStatus.PENDING },
      orderBy: { id: 'asc' },
      take: chunkSize,
      include: { user: { select: { displayName: true } } },
    });

    if (pending.length === 0) {
      await this.prisma.memberDigestBatch.update({
        where: { id: batch.id },
        data: {
          status: MemberDigestBatchStatus.COMPLETED,
          finishedAt: new Date(),
        },
      });
      return { processed: 0 };
    }

    const config = await this.getConfig();
    const content = batch.contentSnapshot as unknown as DigestContent;
    const contentVars = this.renderContentVars(content);
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? '';

    let processed = 0;
    for (const recipient of pending) {
      try {
        const { subject, html } = renderMailTemplate(config.template, {
          displayName: escapeMailText(recipient.user.displayName),
          accountUrl: `${frontendUrl}/tai-khoan`,
          timestamp: formatTimestamp(new Date()),
          ...contentVars,
        });
        await this.mailService.send({ to: recipient.email, subject, html });
        await this.prisma.memberDigestRecipient.update({
          where: { id: recipient.id },
          data: {
            status: MemberDigestRecipientStatus.SENT,
            sentAt: new Date(),
          },
        });
        await this.prisma.memberDigestBatch.update({
          where: { id: batch.id },
          data: { sentCount: { increment: 1 } },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Gửi digest tới ${recipient.email} thất bại: ${message}`,
        );
        await this.prisma.memberDigestRecipient.update({
          where: { id: recipient.id },
          data: {
            status: MemberDigestRecipientStatus.FAILED,
            errorMessage: message,
          },
        });
        await this.prisma.memberDigestBatch.update({
          where: { id: batch.id },
          data: { failedCount: { increment: 1 } },
        });
      }
      processed++;
    }

    const remaining = await this.prisma.memberDigestRecipient.count({
      where: { batchId: batch.id, status: MemberDigestRecipientStatus.PENDING },
    });
    if (remaining === 0) {
      await this.prisma.memberDigestBatch.update({
        where: { id: batch.id },
        data: {
          status: MemberDigestBatchStatus.COMPLETED,
          finishedAt: new Date(),
        },
      });
    }

    return { processed };
  }

  // ───────────────────────── Gửi thử ─────────────────────────

  // Nút "Gửi thử tới tôi" ở trang Admin — dùng dữ liệu mẫu, KHÔNG đụng tới batch/queue (giống
  // mail.service.ts sendTestNotification()). Trả {success,message} thay vì throw để FE hiện lỗi
  // thật thay vì 500 chung chung.
  async sendTestEmail(
    testerEmail: string,
  ): Promise<{ success: boolean; message: string }> {
    const config = await this.getConfig();
    const content = this.sampleContent();
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? '';
    const { subject, html } = renderMailTemplate(config.template, {
      displayName: 'demo_user',
      accountUrl: `${frontendUrl}/tai-khoan`,
      timestamp: formatTimestamp(new Date()),
      ...this.renderContentVars(content),
    });
    try {
      await this.mailService.send({ to: testerEmail, subject, html });
      return { success: true, message: `Đã gửi email thử tới ${testerEmail}.` };
    } catch (err) {
      return {
        success: false,
        message: `Gửi thất bại: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ───────────────────────── Nhật ký (log) ─────────────────────────

  async listBatches(page = 1, limit = 20) {
    const skip = (Math.max(1, page) - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.memberDigestBatch.findMany({
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.memberDigestBatch.count(),
    ]);
    return { items, total, page, limit };
  }

  async getBatchRecipients(batchId: string, page = 1, limit = 50) {
    const skip = (Math.max(1, page) - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.memberDigestRecipient.findMany({
        where: { batchId },
        orderBy: { id: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.memberDigestRecipient.count({ where: { batchId } }),
    ]);
    return { items, total, page, limit };
  }
}
