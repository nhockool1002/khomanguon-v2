import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, WalletTxStatus, WalletTxType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2ClientService } from '../storage/r2-client.service';
import { WalletGateway } from '../realtime/wallet.gateway';
import { MailService } from '../mail/mail.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { EXCLUDE_ADMIN_USER_WHERE } from '../common/exclude-admin-user.filter';
import { resolveStyleRoleSlug } from '../roles/style-role.util';
import { SubscriptionService } from '../subscriptions/subscription.service';
import { CreateDownloadLinkDto } from './dto/create-download-link.dto';
import { UpdateDownloadLinkDto } from './dto/update-download-link.dto';

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

// Nhiều link tải/bài viết (đổi thiết kế — trước đây chỉ hỗ trợ 1 link "chính"/bài, luôn thao tác
// trên bản ghi tạo sớm nhất). Model DownloadLink vốn đã hỗ trợ N bản ghi/postId từ đầu (không có
// @unique trên postId) — giới hạn cũ chỉ nằm ở tầng service, không phải DB.
@Injectable()
export class DownloadLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Client: R2ClientService,
    private readonly walletGateway: WalletGateway,
    private readonly mailService: MailService,
    private readonly auditLog: AuditLogService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async createForPost(postId: string, dto: CreateDownloadLinkDto) {
    await this.assertPostExists(postId);
    await this.assertStorageProviderExists(dto.storageProviderId);

    const link = await this.prisma.downloadLink.create({
      data: {
        postId,
        label: dto.label,
        storageProviderId: dto.storageProviderId,
        objectKey: dto.objectKey,
        sizeBytes: dto.sizeBytes !== undefined ? BigInt(dto.sizeBytes) : null,
        priceP: dto.priceP,
      },
    });
    return toPublicShape(link);
  }

  async updateLink(linkId: string, dto: UpdateDownloadLinkDto) {
    await this.getLinkOrThrow(linkId);
    if (dto.storageProviderId) {
      await this.assertStorageProviderExists(dto.storageProviderId);
    }

    const link = await this.prisma.downloadLink.update({
      where: { id: linkId },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.storageProviderId !== undefined && {
          storageProviderId: dto.storageProviderId,
        }),
        ...(dto.objectKey !== undefined && { objectKey: dto.objectKey }),
        ...(dto.sizeBytes !== undefined && {
          sizeBytes: BigInt(dto.sizeBytes),
        }),
        ...(dto.priceP !== undefined && { priceP: dto.priceP }),
      },
    });
    return toPublicShape(link);
  }

  async deleteLink(linkId: string): Promise<void> {
    await this.getLinkOrThrow(linkId);
    await this.prisma.downloadLink.delete({ where: { id: linkId } });
  }

  async getPublicList(postId: string) {
    const links = await this.prisma.downloadLink.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(links.map((link) => this.toPublicInfo(link)));
  }

  private async toPublicInfo(link: {
    id: string;
    label: string;
    objectKey: string;
    storageProviderId: string;
    sizeBytes: bigint | null;
    priceP: number;
  }) {
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

  // Điểm vào DUY NHẤT từ controller (bổ sung 2026-08-11, thay cho gọi thẳng unlock()) — quyết định
  // user có được tải MIỄN PHÍ theo quota Subscription hay không TRƯỚC KHI đụng vào luồng $P, mà
  // KHÔNG sửa 1 dòng nào trong unlock() ở dưới. Hết quota Subscription (hoặc không có gói) thì rơi
  // thẳng về unlock() y hệt hành vi hiện tại — không có khái niệm "chặn cứng", chỉ là hết phần miễn
  // phí thì tính tiền $P bình thường.
  async unlockSmart(userId: string, linkId: string, ipAddress: string) {
    const eligibility =
      await this.subscriptionService.checkFreeDownloadEligibility(
        userId,
        linkId,
      );
    if (eligibility.eligible && eligibility.membershipId) {
      return this.unlockViaSubscription(
        userId,
        linkId,
        ipAddress,
        eligibility.membershipId,
      );
    }
    return this.unlock(userId, linkId, ipAddress);
  }

  // Tải MIỄN PHÍ qua quota Subscription — KHÔNG đụng Wallet/WalletTransaction (yêu cầu rõ: user
  // Subscription không bị trừ $P). Vẫn ghi DownloadGrant (nhất quán với danh sách "downloaders" ở
  // toPublicInfo()/cloud-files.service.ts) và DownloadEvent (kèm subscriptionMembershipId để
  // SubscriptionService đếm quota đã dùng — xem checkFreeDownloadEligibility) giống hệt nhánh miễn
  // phí (priceP=0) của unlock() ở dưới, chỉ khác việc gắn thêm subscriptionMembershipId.
  private async unlockViaSubscription(
    userId: string,
    linkId: string,
    ipAddress: string,
    subscriptionMembershipId: string,
  ) {
    const link = await this.getLinkOrThrow(linkId);

    await this.prisma.$transaction(async (tx) => {
      await tx.downloadGrant.create({
        data: { userId, downloadLinkId: link.id },
      });
      await tx.downloadEvent.create({
        data: {
          userId,
          downloadLinkId: link.id,
          ipAddress,
          subscriptionMembershipId,
        },
      });
    });

    const url = await this.r2Client.getPresignedDownloadUrl(
      link.storageProviderId,
      link.objectKey,
    );
    return { url };
  }

  // Mỗi lượt tải luôn kiểm tra + trừ ví trong 1 transaction — KHÔNG có khái niệm "đã mở khoá thì
  // tải lại miễn phí" như thiết kế Phase 3 ban đầu (đã bỏ do yêu cầu thực tế: mỗi lần tải = 1 lần
  // trừ $P). DownloadGrant vẫn được ghi mỗi lần tải thành công — không còn dùng để kiểm tra quyền
  // truy cập, chỉ còn là lịch sử mua phục vụ tính doanh thu/danh sách member (cloud-files.service.ts).
  // Nhận thẳng linkId (thay vì postId) — đúng thiết kế nhiều link/bài, mỗi link mở khoá độc lập.
  // KHÔNG SỬA HÀM NÀY khi đụng vào tính năng Subscription — mọi nhánh mới đi qua unlockSmart() ở trên.
  async unlock(userId: string, linkId: string, ipAddress: string) {
    const link = await this.prisma.downloadLink.findUnique({
      where: { id: linkId },
    });
    if (!link) throw new NotFoundException('Không tìm thấy link tải');

    const post = await this.prisma.post.findUnique({
      where: { id: link.postId },
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

  // Nút ẩn "Admin Get Presigned Link" — chỉ user có quyền download.bypass mới gọi được (kiểm tra ở
  // DownloadLinkController). Cố ý KHÔNG đụng tới Wallet/WalletTransaction/DownloadGrant/DownloadEvent
  // (không trừ $P, không hiện trong "Member đã tải" hay lịch sử giao dịch của bất kỳ ai) và không gửi
  // mail thông báo tải — chỉ ghi AuditLog (chỉ Admin xem được qua quyền audit.view riêng) vì đây là
  // năng lực nhạy cảm, dễ bị lạm dụng nếu gán nhầm quyền.
  async adminBypassUnlock(actorUserId: string, linkId: string) {
    const link = await this.prisma.downloadLink.findUnique({
      where: { id: linkId },
    });
    if (!link) throw new NotFoundException('Không tìm thấy link tải');

    const url = await this.r2Client.getPresignedDownloadUrl(
      link.storageProviderId,
      link.objectKey,
    );

    void this.auditLog.log(actorUserId, AuditAction.DOWNLOAD_BYPASSED, {
      targetType: 'download_link',
      targetId: link.id,
      metadata: { postId: link.postId, objectKey: link.objectKey },
    });

    return { url };
  }

  private async getLinkOrThrow(linkId: string) {
    const link = await this.prisma.downloadLink.findUnique({
      where: { id: linkId },
    });
    if (!link) throw new NotFoundException('Không tìm thấy link tải');
    return link;
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
