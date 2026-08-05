import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { resolveStyleRoleSlug } from '../roles/style-role.util';
import { PERMISSIONS } from '../roles/permissions.constant';
import { AuthService } from '../auth/auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateProfileMessageDto } from './dto/create-profile-message.dto';

export type UserSortBy = 'email' | 'displayName' | 'status' | 'createdAt';
export type SortDir = 'asc' | 'desc';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly authService: AuthService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        title: true,
        titleUpdatedAt: true,
        emailVerifiedAt: true,
        createdAt: true,
        displayNameChangedAt: true,
        primaryRoleId: true,
        showPostPopup: true,
        roles: {
          select: {
            roleId: true,
            role: { select: { slug: true, name: true } },
          },
          orderBy: { role: { createdAt: 'asc' } },
        },
      },
    });
    const {
      emailVerifiedAt,
      primaryRoleId,
      roles,
      displayNameChangedAt,
      titleUpdatedAt,
      ...rest
    } = user;
    const permissions = await this.roles.getUserPermissionKeys(userId);
    const titleConfig = await this.roles.getUserTitleConfig(userId);
    return {
      ...rest,
      emailVerified: emailVerifiedAt !== null,
      roles: roles.map((r) => r.role.slug),
      // Vai trò user tự chọn để style tên hiển thị (comment-section, byline...) — chỉ trả về
      // vai trò của chính họ + slug hiệu lực, trang Tài khoản dùng để hiện selector khi >1 role.
      styleRoles: roles.map((r) => ({ slug: r.role.slug, name: r.role.name })),
      primaryRoleSlug: resolveStyleRoleSlug(primaryRoleId, roles),
      // Super Moderator trở lên (quyền user.manage) đổi tên hiển thị tự do; còn lại chỉ 1 lần —
      // FE dùng để khoá ô nhập + hiện đúng thông báo (xem updateProfile()).
      canChangeDisplayName:
        permissions.includes(PERMISSIONS.USER_MANAGE) ||
        displayNameChangedAt === null,
      // FE dùng để ẩn/hiện thao tác quản trị nhạy cảm ngay trên UI (vd nút "Xoá cache" ở topbar,
      // xem navbar.tsx) — chỉ là gợi ý hiển thị, backend vẫn luôn kiểm tra lại bằng PermissionsGuard.
      permissionKeys: permissions,
      // User Title — cấu hình gộp từ mọi role (xem roles/user-title.util.ts) + trạng thái cooldown
      // hiện tại, FE dùng để khoá ô nhập/đếm ngày còn lại (xem updateTitle()).
      userTitleConfig: titleConfig,
      canChangeTitle: this.canChangeTitle(
        titleUpdatedAt,
        titleConfig.cooldownDays,
      ),
      titleChangeAvailableAt: this.titleChangeAvailableAt(
        titleUpdatedAt,
        titleConfig.cooldownDays,
      ),
    };
  }

  private canChangeTitle(
    titleUpdatedAt: Date | null,
    cooldownDays: number | null,
  ): boolean {
    if (titleUpdatedAt === null || cooldownDays === null) return true;
    const availableAt = titleUpdatedAt.getTime() + cooldownDays * 86_400_000;
    return Date.now() >= availableAt;
  }

  private titleChangeAvailableAt(
    titleUpdatedAt: Date | null,
    cooldownDays: number | null,
  ): string | null {
    if (this.canChangeTitle(titleUpdatedAt, cooldownDays)) return null;
    return new Date(
      titleUpdatedAt!.getTime() + cooldownDays! * 86_400_000,
    ).toISOString();
  }

  // Chỉ áp dụng khi user thuộc >1 role — roleSlug rỗng/undefined nghĩa là xoá lựa chọn, quay về
  // fallback role gán sớm nhất (xem style-role.util.ts).
  async updateStyleRole(userId: string, roleSlug?: string) {
    if (!roleSlug) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { primaryRoleId: null },
      });
    } else {
      const userRole = await this.prisma.userRole.findFirst({
        where: { userId, role: { slug: roleSlug } },
        select: { roleId: true },
      });
      if (!userRole) {
        throw new BadRequestException('Bạn không thuộc vai trò này');
      }
      await this.prisma.user.update({
        where: { id: userId },
        data: { primaryRoleId: userRole.roleId },
      });
    }
    return this.getProfile(userId);
  }

  // User Title — dòng chữ tự chọn hiện ở trang hồ sơ. Giới hạn độ dài/HTML/tần suất đổi do role
  // của user quy định (gộp "ưu tiên nhất" qua roles/user-title.util.ts, xem getProfile()) — khác
  // hẳn displayName (chỉ 1 lần miễn phí trong đời tài khoản): ở đây MỌI lần đổi đều bị cooldown lại
  // từ đầu, trừ role có cooldownDays = null (đổi tự do).
  async updateTitle(userId: string, title: string) {
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { title: true, titleUpdatedAt: true },
    });
    if (title === (current.title ?? '')) return this.getProfile(userId);

    const config = await this.roles.getUserTitleConfig(userId);
    if (title.length > config.maxLength) {
      throw new BadRequestException(
        `Title tối đa ${config.maxLength} ký tự (đang nhập ${title.length}).`,
      );
    }
    if (!config.allowHtml && this.looksLikeHtml(title)) {
      throw new BadRequestException(
        'Vai trò của bạn chưa được phép dùng HTML trong Title — liên hệ Admin/Super Moderator nếu cần.',
      );
    }
    if (!this.canChangeTitle(current.titleUpdatedAt, config.cooldownDays)) {
      const availableAt = this.titleChangeAvailableAt(
        current.titleUpdatedAt,
        config.cooldownDays,
      );
      throw new BadRequestException(
        `Bạn chỉ được đổi Title mỗi ${config.cooldownDays} ngày — lần tới có thể đổi vào ${availableAt}.`,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { title, titleUpdatedAt: new Date() },
    });
    return this.getProfile(userId);
  }

  // Heuristic đơn giản (không thêm thư viện sanitize-html/DOMPurify) — chỉ cần biết "có giống thẻ
  // HTML không" để chặn role không được phép, không cần parse đầy đủ. Role được allowHtml=true vẫn
  // được tin cậy render thẳng qua dangerouslySetInnerHTML (cùng mức tin cậy với HtmlWidget/
  // ProseContent — do Admin/Super Moderator quyết định ai được cấp quyền này qua /quan-tri/vai-tro).
  private looksLikeHtml(value: string): boolean {
    return /<[a-z][^>]*>/i.test(value);
  }

  // Đổi tên hiển thị: Super Moderator trở lên (user.manage) đổi tự do; Moderator trở xuống chỉ
  // đổi được 1 lần trong đời tài khoản (đánh dấu bằng displayNameChangedAt, xem schema.prisma).
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: {
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
      displayNameChangedAt?: Date;
      showPostPopup?: boolean;
    } = {
      ...(dto.bio !== undefined && { bio: dto.bio }),
      ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      ...(dto.showPostPopup !== undefined && {
        showPostPopup: dto.showPostPopup,
      }),
    };

    if (dto.displayName !== undefined) {
      const current = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { displayName: true, displayNameChangedAt: true },
      });
      if (dto.displayName !== current.displayName) {
        const permissions = await this.roles.getUserPermissionKeys(userId);
        const canChangeFreely = permissions.includes(PERMISSIONS.USER_MANAGE);
        if (!canChangeFreely && current.displayNameChangedAt !== null) {
          throw new BadRequestException(
            'Bạn chỉ được đổi tên hiển thị 1 lần — liên hệ Admin/Super Moderator nếu cần đổi lại.',
          );
        }
        data.displayName = dto.displayName;
        if (!canChangeFreely) data.displayNameChangedAt = new Date();
      }
    }

    await this.prisma.user.update({ where: { id: userId }, data });
    // Trả về đầy đủ hình dạng Profile (giống updateStyleRole) — FE cần showPostPopup/canChangeDisplayName
    // mới nhất ngay sau khi lưu, không chỉ vài field vừa đổi.
    return this.getProfile(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const currentOk = await argon2.verify(
      user.passwordHash,
      dto.currentPassword,
    );
    if (!currentOk) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    const newPasswordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      }),
      // Đổi mật khẩu xong buộc đăng nhập lại ở mọi nơi — thu hồi hết refresh token đang hoạt động.
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  // Gợi ý @mention trong bình luận + chọn user lọc widget Bình luận — chỉ trả field vốn đã public
  // qua comment/post (id/displayName/avatarUrl), không cần permission đặc biệt (JwtAuthGuard đủ).
  async search(q: string, limit: number) {
    const take = Math.min(Math.max(limit, 1), 20);
    if (!q.trim()) return [];
    return this.prisma.user.findMany({
      where: {
        displayName: { contains: q.trim(), mode: 'insensitive' },
        status: UserStatus.ACTIVE,
      },
      take,
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true, avatarUrl: true },
    });
  }

  async list(
    skip: number,
    take: number,
    search?: string,
    sortBy: UserSortBy = 'createdAt',
    sortDir: SortDir = 'desc',
  ) {
    const where: Prisma.UserWhereInput | undefined = search?.trim()
      ? {
          OR: [
            { email: { contains: search.trim(), mode: 'insensitive' } },
            { displayName: { contains: search.trim(), mode: 'insensitive' } },
          ],
        }
      : undefined;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortDir },
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
          createdAt: true,
          roles: { select: { role: { select: { slug: true, name: true } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map((u) => ({
        ...u,
        roles: u.roles.map((r) => r.role),
      })),
      total,
    };
  }

  // Admin bấm "Đặt lại mật khẩu" thay user — tái dùng thẳng luồng forgotPassword() tự phục vụ (đã có
  // sẵn sinh token + gửi mail), không viết lại logic token riêng. Không throw nếu user không tồn tại
  // (đồng nhất hành vi với forgotPassword), nhưng ở đây id lấy từ danh sách admin nên luôn tồn tại.
  async sendResetPasswordEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    await this.authService.forgotPassword(user.email);
  }

  // Khoá/mở tài khoản (UC08 — chặn user spam bình luận) — khoá xong thu hồi hết refresh
  // token đang hoạt động để có hiệu lực ngay, không phải đợi access token hết hạn.
  async updateStatus(userId: string, status: UserStatus) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { status } }),
      ...(status === UserStatus.BANNED
        ? [
            this.prisma.refreshToken.updateMany({
              where: { userId, revokedAt: null },
              data: { revokedAt: new Date() },
            }),
          ]
        : []),
    ]);
    return { id: userId, status };
  }

  async assignRole(userId: string, roleSlug: string) {
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.role.findUnique({ where: { slug: roleSlug } }),
    ]);
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (!role) throw new BadRequestException('Vai trò không tồn tại');

    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });
    return this.roles.getUserRoleSlugs(userId);
  }

  async removeRole(userId: string, roleSlug: string) {
    const role = await this.prisma.role.findUnique({
      where: { slug: roleSlug },
    });
    if (!role) throw new BadRequestException('Vai trò không tồn tại');

    await this.prisma.userRole.deleteMany({
      where: { userId, roleId: role.id },
    });
    return this.roles.getUserRoleSlugs(userId);
  }

  // ───────────────────────── Trang profile công khai ─────────────────────────

  // Công khai — không lộ email/status, chỉ thông tin đã hiển thị ở byline/bình luận trở lên.
  async getPublicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        title: true,
        createdAt: true,
        primaryRoleId: true,
        roles: {
          select: {
            roleId: true,
            role: { select: { slug: true, name: true } },
          },
          orderBy: { role: { createdAt: 'asc' } },
        },
      },
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    const { primaryRoleId, roles, ...rest } = user;
    // Đọc lại quyền HTML hiện tại của CHỦ profile (không phải người xem) — nếu bị hạ role sau khi
    // đã lưu title chứa HTML thì tự động render lại thành text thường ở lần xem tiếp theo, không
    // bao giờ tin vào nội dung đã lưu để quyết định có render dangerouslySetInnerHTML hay không.
    const titleConfig = await this.roles.getUserTitleConfig(id);
    return {
      ...rest,
      titleAllowHtml: titleConfig.allowHtml,
      styleRoleSlug: resolveStyleRoleSlug(primaryRoleId, roles),
      roleNames: roles.map((r) => r.role.name),
    };
  }

  // Tab "Hoạt động" ở trang Hồ sơ — chỉ chính chủ xem được (kiểm soát ở controller qua /me).
  async listMyActivity(userId: string, page: number, limit: number) {
    const take = Math.min(Math.max(limit, 1), 50);
    const skip = (Math.max(page, 1) - 1) * take;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.userActivity.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: { id: true, type: true, metadata: true, createdAt: true },
      }),
      this.prisma.userActivity.count({ where: { userId } }),
    ]);
    return { items, total };
  }

  private mapMessageAuthor<
    T extends {
      author: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
        primaryRoleId: string | null;
        roles: { roleId: string; role: { slug: string } }[];
      };
    },
  >(message: T) {
    const { author, ...rest } = message;
    const { primaryRoleId, roles, ...authorRest } = author;
    return {
      ...rest,
      author: {
        ...authorRest,
        styleRoleSlug: resolveStyleRoleSlug(primaryRoleId, roles),
      },
    };
  }

  async listProfileMessages(profileUserId: string, skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.profileMessage.findMany({
        where: { profileUserId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              primaryRoleId: true,
              roles: {
                select: { roleId: true, role: { select: { slug: true } } },
                orderBy: { role: { createdAt: 'asc' } },
              },
            },
          },
        },
      }),
      this.prisma.profileMessage.count({ where: { profileUserId } }),
    ]);
    return { items: items.map((m) => this.mapMessageAuthor(m)), total };
  }

  async createProfileMessage(
    profileUserId: string,
    authorId: string,
    dto: CreateProfileMessageDto,
  ) {
    const profileUser = await this.prisma.user.findUnique({
      where: { id: profileUserId },
    });
    if (!profileUser) throw new NotFoundException('Không tìm thấy người dùng');

    const message = await this.prisma.profileMessage.create({
      data: { profileUserId, authorId, content: dto.content },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            primaryRoleId: true,
            roles: {
              select: { roleId: true, role: { select: { slug: true } } },
              orderBy: { role: { createdAt: 'asc' } },
            },
          },
        },
      },
    });
    return this.mapMessageAuthor(message);
  }

  // Xoá được bởi: chính tác giả lời nhắn, chủ profile (được nhắn cho họ), hoặc Moderator+
  // (comment.moderate — tái dùng đúng quyền kiểm duyệt bình luận, không thêm permission riêng).
  async removeProfileMessage(
    messageId: string,
    requesterId: string,
  ): Promise<void> {
    const message = await this.prisma.profileMessage.findUnique({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Không tìm thấy lời nhắn');

    if (
      message.authorId !== requesterId &&
      message.profileUserId !== requesterId
    ) {
      const permissions = await this.roles.getUserPermissionKeys(requesterId);
      if (!permissions.includes(PERMISSIONS.COMMENT_MODERATE)) {
        throw new ForbiddenException('Bạn không có quyền xoá lời nhắn này');
      }
    }
    await this.prisma.profileMessage.delete({ where: { id: messageId } });
  }
}
