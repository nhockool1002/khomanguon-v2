import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
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
      },
    });
    const roleSlugs = await this.roles.getUserRoleSlugs(userId);
    const { emailVerifiedAt, ...rest } = user;
    return {
      ...rest,
      emailVerified: emailVerifiedAt !== null,
      roles: roleSlugs,
    };
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
