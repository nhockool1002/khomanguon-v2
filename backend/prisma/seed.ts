import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLE_USER_TITLE_CONFIG,
} from '../src/roles/permissions.constant';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding permissions...');
  for (const key of ALL_PERMISSION_KEYS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key },
    });
  }

  console.log('Seeding roles...');
  for (const role of Object.values(DEFAULT_ROLES)) {
    // update: {} — không đụng vào role đã tồn tại (giữ tuỳ chỉnh style/User Title Admin đã lưu qua
    // /admin/roles). Giá trị User Title riêng cho 4 role hệ thống chỉ áp lúc TẠO MỚI (fresh
    // DB) — trên DB đã có sẵn 4 role này (production), giá trị đúng do migration
    // 20260804220000_add_user_title UPDATE theo slug đảm nhiệm.
    const titleConfig = DEFAULT_ROLE_USER_TITLE_CONFIG[role.slug];
    await prisma.role.upsert({
      where: { slug: role.slug },
      update: {},
      create: {
        slug: role.slug,
        name: role.name,
        isSystem: true,
        ...(titleConfig && {
          userTitleCooldownDays: titleConfig.cooldownDays,
          userTitleAllowHtml: titleConfig.allowHtml,
          userTitleMaxLength: titleConfig.maxLength,
        }),
      },
    });
  }

  console.log('Linking role <-> permissions...');
  for (const [roleSlug, permissionKeys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { slug: roleSlug } });
    for (const key of permissionKeys) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    console.log(`Seeding admin user ${adminEmail}...`);
    const passwordHash = await argon2.hash(adminPassword);
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        passwordHash,
        displayName: 'Admin',
        emailVerifiedAt: new Date(),
        wallet: { create: { balance: 0 } },
      },
    });
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { slug: DEFAULT_ROLES.ADMIN.slug },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: adminRole.id },
    });
  } else {
    console.log('SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD chưa đặt — bỏ qua seed admin user.');
  }

  console.log('Seeding default widgets (nếu chưa có)...');
  const widgetCount = await prisma.widget.count();
  if (widgetCount === 0) {
    await prisma.widget.create({
      data: { type: 'SEARCH', title: '', area: 'sidebar', order: 0, isActive: true, config: {} },
    });
    await prisma.widget.create({
      data: { type: 'CATEGORIES', title: 'Danh mục', area: 'sidebar', order: 1, isActive: true, config: {} },
    });
  } else {
    console.log('Đã có widget — bỏ qua seed mặc định.');
  }

  console.log('Seed xong.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
