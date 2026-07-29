import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_ROLES } from './permissions.constant';

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
}
