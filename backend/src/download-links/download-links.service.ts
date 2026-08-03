import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WalletTxStatus, WalletTxType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2ClientService } from '../storage/r2-client.service';
import { WalletGateway } from '../realtime/wallet.gateway';
import { MailService } from '../mail/mail.service';
import { EXCLUDE_ADMIN_USER_WHERE } from '../common/exclude-admin-user.filter';
import { resolveStyleRoleSlug } from '../roles/style-role.util';
import { UpsertDownloadLinkDto } from './dto/upsert-download-link.dto';

const DOWNLOADER_LIST_LIMIT = 20;

function toPublicShape(link: {
  id: string;
  label: string;
  objectKey: string;
  sizeBytes: bigint | null;
  priceP: number;
}) {
  return {
    id: link.id,
    label: link.label,
    objectKey: link.objectKey,
    sizeBytes: link.sizeBytes === null ? null : Number(link.sizeBytes),
    priceP: link.priceP,
  };
}

// Mỗi post chỉ có 1 link tải "chính" trong phạm vi hiện tại (khớp dữ liệu WP cũ: custom_key/custom_cash
// 1-1 theo post) — model DownloadLink hỗ trợ nhiều bản ghi/post để dành mở rộng sau, ở đây luôn thao tác
// trên bản ghi tạo sớm nhất của post.
@Injectable()
export class DownloadLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Client: R2ClientService,
    private readonly walletGateway: WalletGateway,
    private readonly mailService: MailService,
  ) {}

  private findPrimary(postId: string) {
    return this.prisma.downloadLink.findFirst({
      where: { postId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getForAdmin(postId: string) {
    const link = await this.findPrimary(postId);
    return link ? toPublicShape(link) : null;
  }

  async upsertForPost(postId: string, dto: UpsertDownloadLinkDto) {
    await this.assertPostExists(postId);
    await this.assertStorageProviderExists(dto.storageProviderId);

    const existing = await this.findPrimary(postId);
    const data = {
      label: dto.label,
      storageProviderId: dto.storageProviderId,
      objectKey: dto.objectKey,
      sizeBytes: dto.sizeBytes !== undefined ? BigInt(dto.sizeBytes) : null,
      priceP: dto.priceP,
    };

    const link = existing
      ? await this.prisma.downloadLink.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.downloadLink.create({ data: { postId, ...data } });

    return toPublicShape(link);
  }

  async getPublicInfo(postId: string) {
    const link = await this.findPrimary(postId);
    if (!link) return null;

    const [downloaders, sizeBytes] = await Promise.all([
      this.prisma.downloadGrant.findMany({
        where: { downloadLinkId: link.id, ...EXCLUDE_ADMIN_USER_WHERE },
        orderBy: { purchasedAt: 'desc' },
        take: DOWNLOADER_LIST_LIMIT,
        distinct: ['userId'],
        select: {
          user: {
            select: {
              id: true,
              displayName: true,
              primaryRoleId: true,
              roles: {
                select: { roleId: true, role: { select: { slug: true } } },
                orderBy: { role: { createdAt: 'asc' } },
              },
            },
          },
        },
      }),
      this.resolveSizeBytes(link),
    ]);

    return {
      ...toPublicShape(link),
      sizeBytes,
      // Style tên (màu/đậm/nghiêng/font theo role) — khớp cách bình luận/byline bài viết đã làm,
      // không phải plain string như trước (xem components/download-box.tsx + StyledUserName).
      // id để FE link sang trang profile công khai (/nguoi-dung/[id]).
      downloaders: downloaders.map(({ user }) => ({
        id: user.id,
        displayName: user.displayName,
        styleRoleSlug: resolveStyleRoleSlug(user.primaryRoleId, user.roles),
      })),
    };
  }

  // Tự bổ sung dung lượng cho các link đã tạo từ TRƯỚC khi form Admin có ô "Dò dung lượng"/gửi
  // sizeBytes — không bắt Admin phải vào sửa lại từng bài. Chỉ HEAD object 1 lần rồi lưu vào DB
  // (best-effort, không throw nếu update lỗi); các lần đọc sau lấy thẳng từ cột đã lưu, không gọi
  // lại S3/R2 mỗi request.
  private async resolveSizeBytes(link: {
    id: string;
    storageProviderId: string;
    objectKey: string;
    sizeBytes: bigint | null;
  }): Promise<number | null> {
    if (link.sizeBytes !== null) return Number(link.sizeBytes);

    const detected = await this.r2Client.headObjectSize(
      link.storageProviderId,
      link.objectKey,
    );
    if (detected === null) return null;

    await this.prisma.downloadLink
      .update({ where: { id: link.id }, data: { sizeBytes: BigInt(detected) } })
      .catch(() => {});
    return detected;
  }

  // Mỗi lượt tải luôn kiểm tra + trừ ví trong 1 transaction — KHÔNG có khái niệm "đã mở khoá thì
  // tải lại miễn phí" như thiết kế Phase 3 ban đầu (đã bỏ do yêu cầu thực tế: mỗi lần tải = 1 lần
  // trừ $P). DownloadGrant vẫn được ghi mỗi lần tải thành công — không còn dùng để kiểm tra quyền
  // truy cập, chỉ còn là lịch sử mua phục vụ tính doanh thu/danh sách member (cloud-files.service.ts).
  async unlock(userId: string, postId: string, ipAddress: string) {
    const link = await this.findPrimary(postId);
    if (!link) throw new NotFoundException('Bài viết này chưa có link tải');

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { title: true },
    });
    const fileName = link.objectKey.split('/').pop() || link.label;
    // Ghi rõ tên bài viết + file vào note của WalletTransaction — trang Quản lý giao dịch ($P) chỉ
    // có referenceType/referenceId (id thô, không đọc được) nên trước đây không biết ngay giao dịch
    // ứng với file/game nào nếu không tra riêng.
    const transactionNote = post ? `${post.title} — ${fileName}` : fileName;

    let newBalance: number | null = null;
    await this.prisma.$transaction(async (tx) => {
      if (link.priceP > 0) {
        const wallet = await tx.wallet.upsert({
          where: { userId },
          update: {},
          create: { userId, balance: 0 },
        });
        if (wallet.balance < link.priceP) {
          throw new HttpException(
            'Số dư $P không đủ để tải file này',
            HttpStatus.PAYMENT_REQUIRED,
          );
        }
        const balanceAfter = wallet.balance - link.priceP;
        await tx.wallet.update({
          where: { userId },
          data: { balance: balanceAfter },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTxType.PURCHASE,
            amount: -link.priceP,
            balanceAfter,
            status: WalletTxStatus.SUCCESS,
            referenceType: 'download_link',
            referenceId: link.id,
            note: transactionNote,
          },
        });
        newBalance = balanceAfter;
      }

      await tx.downloadGrant.create({
        data: { userId, downloadLinkId: link.id },
      });
      await tx.downloadEvent.create({
        data: { userId, downloadLinkId: link.id, ipAddress },
      });
    });

    if (newBalance !== null) {
      this.walletGateway.emitWalletUpdated(userId, { balance: newBalance });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, email: true },
    });
    if (user) {
      // Không await — gửi mail thông báo là side-effect phụ, không được làm chậm việc trả link tải
      // về cho user (sendDownloadUnlockNotification tự bắt lỗi bên trong, không reject ra ngoài).
      // Gửi cho cả Admin (notifyEmail) lẫn chính user vừa tải (user.email).
      void this.mailService.sendDownloadUnlockNotification(
        {
          displayName: user.displayName,
          postTitle: post?.title ?? '',
          fileName,
          priceP: String(link.priceP),
        },
        user.email,
      );
    }

    const url = await this.r2Client.getPresignedDownloadUrl(
      link.storageProviderId,
      link.objectKey,
    );
    return { url };
  }

  private async assertPostExists(postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
  }

  private async assertStorageProviderExists(
    storageProviderId: string,
  ): Promise<void> {
    const provider = await this.prisma.storageProvider.findUnique({
      where: { id: storageProviderId },
    });
    if (!provider)
      throw new BadRequestException('Storage provider không tồn tại');
  }
}
