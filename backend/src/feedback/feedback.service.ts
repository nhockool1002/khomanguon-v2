import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeedbackStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

// Chặn bản trùng khi người dùng bấm gửi lại cùng 1 nội dung (double-click, gửi lại vì tưởng lỗi)
// — trước đây sinh 2 bản ghi giống hệt nhau, Admin đánh dấu xử lý 1 bản thì bản kia vẫn "Chờ xử lý".
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

const listSelect = {
  id: true,
  name: true,
  email: true,
  message: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
  replyMessage: true,
  repliedAt: true,
  author: { select: { id: true, displayName: true, email: true } },
  resolvedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.FeedbackSelect;

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // authorId null = gửi ẩn danh — name/email lấy thẳng từ dto (email BẮT BUỘC để Admin còn phản hồi
  // được qua feedbackReply); đã đăng nhập thì
  // bỏ qua dto.name/dto.email (đã có sẵn qua quan hệ `author`, tránh lưu trùng dữ liệu lệch nhau nếu
  // sau này user đổi displayName/email). Gửi mail Admin fire-and-forget, cùng convention
  // link-reports.service.ts — không await, không được làm chậm/hỏng response.
  async create(authorId: string | null, dto: CreateFeedbackDto) {
    const author = authorId
      ? await this.prisma.user.findUnique({
          where: { id: authorId },
          select: { displayName: true, email: true },
        })
      : null;
    const email = dto.email?.trim();
    if (!author && !email) {
      throw new BadRequestException('Vui lòng nhập email để nhận phản hồi');
    }

    const message = dto.message.trim();
    const duplicate = await this.prisma.feedback.findFirst({
      where: {
        message,
        status: FeedbackStatus.PENDING,
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
        ...(authorId ? { authorId } : { authorId: null, email }),
      },
    });
    if (duplicate) return duplicate;

    const feedback = await this.prisma.feedback.create({
      data: {
        authorId: authorId ?? undefined,
        name: author ? undefined : dto.name?.trim() || undefined,
        email: author ? undefined : email,
        message,
      },
    });

    void this.mailService.sendFeedbackAdminNotification({
      displayName: author?.displayName ?? dto.name?.trim() ?? 'Ẩn danh',
      contactEmail: author?.email ?? email ?? '(không có)',
      message,
    });

    return feedback;
  }

  async listForModeration(query: {
    status?: FeedbackStatus;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const take = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const skip = (Math.max(query.page ?? 1, 1) - 1) * take;
    const where: Prisma.FeedbackWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.q && {
        OR: [
          { message: { contains: query.q, mode: 'insensitive' } },
          { name: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
          {
            author: {
              displayName: { contains: query.q, mode: 'insensitive' },
            },
          },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: listSelect,
      }),
      this.prisma.feedback.count({ where }),
    ]);
    return { items, total };
  }

  // Chỉ đánh dấu đã xử lý, không gửi mail — muốn trả lời người góp ý thì dùng reply().
  async resolve(id: string, resolvedById: string) {
    const existing = await this.prisma.feedback.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy góp ý');

    return this.prisma.feedback.update({
      where: { id },
      data: {
        status: FeedbackStatus.RESOLVED,
        resolvedById,
        resolvedAt: new Date(),
      },
      select: listSelect,
    });
  }

  // Gửi email phản hồi (template feedbackReply) rồi mới đánh dấu RESOLVED — gửi lỗi thì throw để
  // Admin biết, không lưu trạng thái "đã phản hồi" giả. Người nhận: email tài khoản (đã đăng nhập
  // lúc góp ý) hoặc email khách ẩn danh để lại. Góp ý cũ trước khi email bắt buộc có thể không có.
  async reply(id: string, resolvedById: string, replyMessage: string) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id },
      select: {
        name: true,
        email: true,
        message: true,
        author: { select: { displayName: true, email: true } },
      },
    });
    if (!feedback) throw new NotFoundException('Không tìm thấy góp ý');

    const to = feedback.author?.email ?? feedback.email;
    if (!to) {
      throw new BadRequestException(
        'Góp ý này không có email liên hệ — không thể gửi phản hồi',
      );
    }

    const message = replyMessage.trim();
    try {
      await this.mailService.sendFeedbackReply(
        {
          displayName: feedback.author?.displayName ?? feedback.name ?? 'bạn',
          originalMessage: feedback.message,
          replyMessage: message,
        },
        to,
      );
    } catch (err) {
      throw new BadRequestException(
        `Gửi email phản hồi thất bại: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const now = new Date();
    return this.prisma.feedback.update({
      where: { id },
      data: {
        status: FeedbackStatus.RESOLVED,
        resolvedById,
        resolvedAt: now,
        replyMessage: message,
        repliedAt: now,
      },
      select: listSelect,
    });
  }
}
