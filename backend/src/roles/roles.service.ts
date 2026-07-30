import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildUniqueSlug } from '../common/slugify';
import { DEFAULT_ROLES } from './permissions.constant';

const roleWithPermissionsSelect = {
  id: true,
  name: true,
  slug: true,
  isSystem: true,
  permissions: { select: { permission: { select: { key: true } } } },
} as const;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

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

  async assignDefaultRole(userId: string): Promise<void> {
    const member = await this.prisma.role.findUnique({
      where: { slug: DEFAULT_ROLES.MEMBER.slug },
    });
    if (!member) return;
    await this.prisma.userRole.create({
      data: { userId, roleId: member.id },
    });
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

  async createRole(dto: { name: string; permissionKeys: string[] }) {
    const slug = await buildUniqueSlug(dto.name, (candidate) =>
      this.slugTaken(candidate),
    );
    const role = await this.prisma.role.create({
      data: { name: dto.name, slug, isSystem: false },
    });
    await this.syncRolePermissions(role.id, dto.permissionKeys);
    return this.getRole(role.id);
  }

  async updateRole(
    id: string,
    dto: { name?: string; permissionKeys?: string[] },
  ) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');

    if (dto.name !== undefined) {
      await this.prisma.role.update({
        where: { id },
        data: { name: dto.name },
      });
    }
    if (dto.permissionKeys !== undefined) {
      await this.syncRolePermissions(id, dto.permissionKeys);
    }
    return this.getRole(id);
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    if (role.isSystem) {
      throw new BadRequestException('Không thể xoá vai trò hệ thống');
    }
    await this.prisma.role.delete({ where: { id } });
  }

  private toRoleDto(role: {
    id: string;
    name: string;
    slug: string;
    isSystem: boolean;
    permissions: { permission: { key: string } }[];
  }) {
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      isSystem: role.isSystem,
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
