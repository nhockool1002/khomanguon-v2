import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { resolveStyleRoleSlug } from '../roles/style-role.util';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
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
        emailVerifiedAt: true,
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
    const { emailVerifiedAt, primaryRoleId, roles, ...rest } = user;
    return {
      ...rest,
      emailVerified: emailVerifiedAt !== null,
      roles: roles.map((r) => r.role.slug),
      // Vai trò user tự chọn để style tên hiển thị (comment-section, byline...) — chỉ trả về
      // vai trò của chính họ + slug hiệu lực, trang Tài khoản dùng để hiện selector khi >1 role.
      styleRoles: roles.map((r) => ({ slug: r.role.slug, name: r.role.name })),
      primaryRoleSlug: resolveStyleRoleSlug(primaryRoleId, roles),
    };
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

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
      },
    });
    return user;
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

  async list(skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
          createdAt: true,
          roles: { select: { role: { select: { slug: true, name: true } } } },
        },
      }),
      this.prisma.user.count(),
    ]);
    return {
      items: items.map((u) => ({
        ...u,
        roles: u.roles.map((r) => r.role),
      })),
      total,
    };
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
}
