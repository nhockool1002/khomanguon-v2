import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLE_USER_TITLE_CONFIG,
} from '../src/roles/permissions.constant';
import { BADGE_DEFINITIONS } from '../src/badges/badge-definitions.constant';
import { GameWinConditionType, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// 12 level mặc định của mini-game nội bộ CMS (xem backend/src/game) — id cố định "level-01"..
// "level-12" (lý do: GameLevel.id trong schema.prisma). update: {} để KHÔNG ghi đè chỉnh sửa Admin
// đã lưu qua trang Cài đặt Game khi seed chạy lại ở lần deploy sau (prisma db seed chạy mọi lần
// deploy — xem .github/workflows/ci.yml). Thứ tự = thứ tự dải trong ảnh nguồn từ trên xuống, khớp
// scripts/slice-game-maps.py.
const GAME_LEVELS: Prisma.GameLevelCreateInput[] = [
  { id: 'level-01', order: 1, name: 'Đồng cỏ xanh', skyThemeKey: 'clear_day', backgroundUrl: '/game/maps/level-01.webp', winConditionType: GameWinConditionType.ITEM_COLLECT, targetCount: 5, rewardP: 10 },
  { id: 'level-02', order: 2, name: 'Hang đất ngầm', skyThemeKey: 'cave_dim', backgroundUrl: '/game/maps/level-02.webp', winConditionType: GameWinConditionType.MONSTER_CATCH, targetCount: 3, rewardP: 12 },
  { id: 'level-03', order: 3, name: 'Gai pha lê đỏ', skyThemeKey: 'lava_haze', backgroundUrl: '/game/maps/level-03.webp', winConditionType: GameWinConditionType.MONSTER_CATCH, targetCount: 3, rewardP: 14 },
  { id: 'level-04', order: 4, name: 'Rạn pha lê biển sâu', skyThemeKey: 'underwater_teal', backgroundUrl: '/game/maps/level-04.webp', winConditionType: GameWinConditionType.ITEM_COLLECT, targetCount: 6, rewardP: 16 },
  { id: 'level-05', order: 5, name: 'San hô hồng ngọc', skyThemeKey: 'underwater_pink', backgroundUrl: '/game/maps/level-05.webp', winConditionType: GameWinConditionType.ITEM_COLLECT, targetCount: 6, rewardP: 18 },
  { id: 'level-06', order: 6, name: 'Đá vàng ngọc chunk', skyThemeKey: 'dusk_amber', backgroundUrl: '/game/maps/level-06.webp', winConditionType: GameWinConditionType.ITEM_COLLECT, targetCount: 7, rewardP: 20 },
  { id: 'level-07', order: 7, name: 'Đồng hoa vàng', skyThemeKey: 'meadow_warm', backgroundUrl: '/game/maps/level-07.webp', winConditionType: GameWinConditionType.ITEM_COLLECT, targetCount: 7, rewardP: 22 },
  { id: 'level-08', order: 8, name: 'Hang gai hồng', skyThemeKey: 'cave_pink', backgroundUrl: '/game/maps/level-08.webp', winConditionType: GameWinConditionType.MONSTER_CATCH, targetCount: 4, rewardP: 24 },
  { id: 'level-09', order: 9, name: 'Cồn cát sa mạc', skyThemeKey: 'desert_heat', backgroundUrl: '/game/maps/level-09.webp', winConditionType: GameWinConditionType.ITEM_COLLECT, targetCount: 8, rewardP: 26 },
  { id: 'level-10', order: 10, name: 'Hang pha lê tím', skyThemeKey: 'cave_purple', backgroundUrl: '/game/maps/level-10.webp', winConditionType: GameWinConditionType.MONSTER_CATCH, targetCount: 4, rewardP: 28 },
  { id: 'level-11', order: 11, name: 'Đầm lầy dung nham hồng', skyThemeKey: 'magenta_haze', backgroundUrl: '/game/maps/level-11.webp', winConditionType: GameWinConditionType.MONSTER_CATCH, targetCount: 5, rewardP: 30 },
  { id: 'level-12', order: 12, name: 'Nước băng pha lê', skyThemeKey: 'ice_blue', backgroundUrl: '/game/maps/level-12.webp', winConditionType: GameWinConditionType.ITEM_COLLECT, targetCount: 10, rewardP: 40 },
];

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

  console.log('Seeding badges...');
  for (const badge of BADGE_DEFINITIONS) {
    await prisma.badge.upsert({
      where: { slug: badge.slug },
      update: { name: badge.name, description: badge.description, icon: badge.icon },
      create: badge,
    });
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

  console.log('Seeding game levels...');
  for (const level of GAME_LEVELS) {
    await prisma.gameLevel.upsert({
      where: { id: level.id },
      update: {}, // không ghi đè chỉnh sửa Admin đã lưu qua trang Cài đặt Game
      create: level,
    });
  }

  console.log('Seed xong.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
