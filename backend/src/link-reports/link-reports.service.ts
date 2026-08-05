import { Injectable, NotFoundException } from '@nestjs/common';
import { LinkReportStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateLinkReportDto } from './dto/create-link-report.dto';

const listSelect = {
  id: true,
  note: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
  downloadLink: {
    select: {
      id: true,
      label: true,
      objectKey: true,
      post: { select: { id: true, title: true, slug: true } },
    },
  },
  reporter: { select: { id: true, displayName: true, email: true } },
  resolvedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.LinkReportSelect;

function fileNameOf(link: { objectKey: string; label: string }): string {
  return link.objectKey.split('/').pop() || link.label;
}

@Injectable()
export class LinkReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // Tạo báo cáo + fire-and-forget email Admin — đúng convention download-links.service.ts/
  // sepay.service.ts: gửi mail là side-effect phụ, không await, không được làm chậm/hỏng response.
  async create(reporterId: string, dto: CreateLinkReportDto) {
    const link = await this.prisma.downloadLink.findUnique({
      where: { id: dto.downloadLinkId },
      select: {
        id: true,
        label: true,
        objectKey: true,
        post: { select: { title: true } },
      },
    });
    if (!link) throw new NotFoundException('Không tìm thấy link tải');

    const [report, reporter] = await Promise.all([
      this.prisma.linkReport.create({
        data: {
          downloadLinkId: dto.downloadLinkId,
          reporterId,
          note: dto.note,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: reporterId },
        select: { displayName: true },
      }),
    ]);

    void this.mailService.sendLinkReportAdminNotification({
      displayName: reporter?.displayName ?? '',
      postTitle: link.post.title,
      fileName: fileNameOf(link),
      note: dto.note ?? '(không có ghi chú)',
    });

    return report;
  }

  async listForModeration(query: {
    status?: LinkReportStatus;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const take = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const skip = (Math.max(query.page ?? 1, 1) - 1) * take;
    const where: Prisma.LinkReportWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.q && {
        OR: [
          { note: { contains: query.q, mode: 'insensitive' } },
          {
            reporter: {
              displayName: { contains: query.q, mode: 'insensitive' },
            },
          },
          {
            downloadLink: {
              post: { title: { contains: query.q, mode: 'insensitive' } },
            },
          },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.linkReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: listSelect,
      }),
      this.prisma.linkReport.count({ where }),
    ]);
    return { items, total };
  }

  // Đánh dấu đã xử lý + fire-and-forget email cho đúng người đã báo cáo (không liên quan notifyEmail
  // Admin — giống pattern passwordReset ở mail.service.ts, "gửi CHO USER").
  async resolve(id: string, resolvedById: string) {
    const existing = await this.prisma.linkReport.findUnique({
      where: { id },
      select: {
        id: true,
        reporter: { select: { displayName: true, email: true } },
        downloadLink: {
          select: {
            label: true,
            objectKey: true,
            post: { select: { title: true } },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy báo cáo');

    const updated = await this.prisma.linkReport.update({
      where: { id },
      data: {
        status: LinkReportStatus.RESOLVED,
        resolvedById,
        resolvedAt: new Date(),
      },
      select: listSelect,
    });

    void this.mailService.sendLinkReportResolvedNotification(
      {
        displayName: existing.reporter.displayName,
        postTitle: existing.downloadLink.post.title,
        fileName: fileNameOf(existing.downloadLink),
      },
      existing.reporter.email,
    );

    return updated;
  }
}
