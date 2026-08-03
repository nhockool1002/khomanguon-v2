import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildUniqueSlug } from '../common/slugify';
import { DEFAULT_ROLES } from './permissions.constant';
import { CacheService } from '../cache/cache.service';

const roleWithPermissionsSelect = {
  id: true,
  name: true,
  slug: true,
  isSystem: true,
  title: true,
  color: true,
  bold: true,
  italic: true,
  fontFamily: true,
  permissions: { select: { permission: { select: { key: true } } } },
} as const;

export interface RoleStyleInput {
  title?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  fontFamily?: string;
}

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getUserPermissionKeys(userId: string): Promise<string[]> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { role: { users: { some: { userId } } } },
      select: { permission: { select: { key: true } } },
    });
    return [...new Set(rows.map((r) => r.permission.key))];
  }

  async getUserRoleSlugs(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      select: { role: { select: { slug: true } } },
    });
    return rows.map((r) => r.role.slug);
  }

  // Gán role UNVERIFIED (không phải MEMBER) lúc đăng ký — chỉ nâng lên MEMBER sau khi xác minh
  // email thành công (xem upgradeAfterVerification), chặn tài khoản ảo/spam email tải file ngay.
  async assignDefaultRole(userId: string): Promise<void> {
    const unverified = await this.prisma.role.findUnique({
      where: { slug: DEFAULT_ROLES.UNVERIFIED.slug },
    });
    if (!unverified) return;
    await this.prisma.userRole.create({
      data: { userId, roleId: unverified.id },
    });
  }

  // Gọi ngay sau khi verifyEmail() thành công (auth.service.ts) — thay role UNVERIFIED bằng MEMBER.
  // Chỉ đụng vào nếu user THỰC SỰ còn giữ role UNVERIFIED — nếu Admin đã tự gán role khác trước đó
  // (vd thăng Moderator dù chưa xác minh) thì không đụng vào, tránh ghi đè quyết định thủ công.
  async upgradeAfterVerification(userId: string): Promise<void> {
    const [unverified, member] = await Promise.all([
      this.prisma.role.findUnique({
        where: { slug: DEFAULT_ROLES.UNVERIFIED.slug },
      }),
      this.prisma.role.findUnique({
        where: { slug: DEFAULT_ROLES.MEMBER.slug },
      }),
    ]);
    if (!unverified || !member) return;

    const hasUnverified = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId: unverified.id } },
    });
    if (!hasUnverified) return;

    await this.prisma.$transaction([
      this.prisma.userRole.delete({
        where: { userId_roleId: { userId, roleId: unverified.id } },
      }),
      this.prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId: member.id } },
        update: {},
        create: { userId, roleId: member.id },
      }),
    ]);
  }

  // Ma trận quyền tick chọn theo module (UC17, wireframe #11) — Admin tạo/sửa role tuỳ chỉnh tự do.
  async listRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      select: roleWithPermissionsSelect,
    });
    return roles.map((r) => this.toRoleDto(r));
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { key: 'asc' },
      select: { id: true, key: true, description: true },
    });
  }

  // Công khai — badge role hiện cạnh bình luận/byline bài viết cần style này kể cả với khách
  // vãng lai chưa đăng nhập, nên tách riêng khỏi listRoles() (vốn yêu cầu role.manage).
  async listBadges() {
    return this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        slug: true,
        name: true,
        title: true,
        color: true,
        bold: true,
        italic: true,
        fontFamily: true,
      },
    });
  }

  async createRole(dto: {
    name: string;
    permissionKeys: string[];
    style?: RoleStyleInput;
  }) {
    const slug = await buildUniqueSlug(dto.name, (candidate) =>
      this.slugTaken(candidate),
    );
    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        slug,
        isSystem: false,
        ...this.styleData(dto.style),
      },
    });
    await this.syncRolePermissions(role.id, dto.permissionKeys);
    await this.cache.invalidatePrefix('roles');
    return this.getRole(role.id);
  }

  async updateRole(
    id: string,
    dto: {
      name?: string;
      permissionKeys?: string[];
      style?: RoleStyleInput;
    },
  ) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');

    const data = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...this.styleData(dto.style),
    };
    if (Object.keys(data).length > 0) {
      await this.prisma.role.update({ where: { id }, data });
    }
    if (dto.permissionKeys !== undefined) {
      await this.syncRolePermissions(id, dto.permissionKeys);
    }
    await this.cache.invalidatePrefix('roles');
    return this.getRole(id);
  }

  // Chuỗi rỗng từ FE nghĩa là "xoá" — chuyển thành null để badge tự fallback (title -> name,
  // color/fontFamily -> mặc định).
  private styleData(style?: RoleStyleInput) {
    if (!style) return {};
    return {
      ...(style.title !== undefined && { title: style.title || null }),
      ...(style.color !== undefined && { color: style.color || null }),
      ...(style.bold !== undefined && { bold: style.bold }),
      ...(style.italic !== undefined && { italic: style.italic }),
      ...(style.fontFamily !== undefined && {
        fontFamily: style.fontFamily || null,
      }),
    };
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    if (role.isSystem) {
      throw new BadRequestException('Không thể xoá vai trò hệ thống');
    }
    await this.prisma.role.delete({ where: { id } });
    await this.cache.invalidatePrefix('roles');
  }

  private toRoleDto(role: {
    id: string;
    name: string;
    slug: string;
    isSystem: boolean;
    title: string | null;
    color: string | null;
    bold: boolean;
    italic: boolean;
    fontFamily: string | null;
    permissions: { permission: { key: string } }[];
  }) {
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      isSystem: role.isSystem,
      title: role.title,
      color: role.color,
      bold: role.bold,
      italic: role.italic,
      fontFamily: role.fontFamily,
      permissionKeys: role.permissions.map((p) => p.permission.key),
    };
  }

  private async getRole(id: string) {
    const role = await this.prisma.role.findUniqueOrThrow({
      where: { id },
      select: roleWithPermissionsSelect,
    });
    return this.toRoleDto(role);
  }

  private async syncRolePermissions(
    roleId: string,
    permissionKeys: string[],
  ): Promise<void> {
    const permissions = permissionKeys.length
      ? await this.prisma.permission.findMany({
          where: { key: { in: permissionKeys } },
        })
      : [];
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      ...permissions.map((p) =>
        this.prisma.rolePermission.create({
          data: { roleId, permissionId: p.id },
        }),
      ),
    ]);
  }

  private async slugTaken(slug: string): Promise<boolean> {
    const existing = await this.prisma.role.findUnique({ where: { slug } });
    return existing !== null;
  }
}
