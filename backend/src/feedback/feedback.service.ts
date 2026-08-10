import { Injectable, NotFoundException } from '@nestjs/common';
import { FeedbackStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

const listSelect = {
  id: true,
  name: true,
  email: true,
  message: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
  author: { select: { id: true, displayName: true, email: true } },
  resolvedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.FeedbackSelect;

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // authorId null = gửi ẩn danh — name/email lấy thẳng từ dto trong trường hợp đó; đã đăng nhập thì
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

    const feedback = await this.prisma.feedback.create({
      data: {
        authorId: authorId ?? undefined,
        name: author ? undefined : dto.name,
        email: author ? undefined : dto.email,
        message: dto.message,
      },
    });

    void this.mailService.sendFeedbackAdminNotification({
      displayName: author?.displayName ?? dto.name?.trim() ?? 'Ẩn danh',
      contactEmail: author?.email ?? dto.email?.trim() ?? '(không có)',
      message: dto.message,
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

  // Không gửi mail xác nhận lại cho người gửi khi resolve (khác LinkReport) — người gửi Feedback có
  // thể hoàn toàn ẩn danh, không có email để gửi tới.
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
}
