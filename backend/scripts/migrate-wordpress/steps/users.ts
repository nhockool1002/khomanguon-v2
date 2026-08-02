import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { DEFAULT_ROLES } from '../../../src/roles/permissions.constant';
import { extractWpCapabilityRoles } from '../php-serialize';
import type { MigrationContext } from '../context';

// user_pass của WP (phpass/$P$) không tương thích Argon2 của v2 — không migrate được, set random
// hash không ai đoán ra được; user cũ tự "Quên mật khẩu" khi quay lại (Migration_Plan.md §4.1 phương án A).
async function randomUnusablePasswordHash(): Promise<string> {
  return argon2.hash(randomBytes(32).toString('hex'));
}

export async function migrateUsers(ctx: MigrationContext): Promise<void> {
  const summary = ctx.report.startStep('users');
  const [wpUsers, capabilityRows] = await Promise.all([
    ctx.wp.users(),
    ctx.wp.userMeta('src_capabilities'),
  ]);
  summary.read = wpUsers.length;

  const capabilitiesByUserId = new Map(capabilityRows.map((r) => [r.user_id, r.meta_value]));

  const adminRole = await ctx.prisma.role.findUnique({ where: { slug: DEFAULT_ROLES.ADMIN.slug } });
  const memberRole = await ctx.prisma.role.findUnique({ where: { slug: DEFAULT_ROLES.MEMBER.slug } });
  if (!adminRole || !memberRole) {
    throw new Error('Chưa seed roles mặc định — chạy `pnpm prisma db seed` trước khi migrate.');
  }

  for (const wpUser of wpUsers) {
    try {
      const email = wpUser.user_email.trim().toLowerCase();
      const capabilities = capabilitiesByUserId.get(wpUser.ID);
      const isAdmin = capabilities ? extractWpCapabilityRoles(capabilities).includes('administrator') : false;

      const existing = await ctx.prisma.user.findUnique({ where: { email } });

      if (ctx.dryRun) {
        ctx.maps.userIdToNewId.set(wpUser.ID, existing?.id ?? `dryrun:${email}`);
        existing ? summary.skipped++ : summary.created++;
        continue;
      }

      const user = existing
        ? existing
        : await ctx.prisma.user.create({
            data: {
              email,
              passwordHash: await randomUnusablePasswordHash(),
              displayName: wpUser.display_name || email,
              status: 'ACTIVE',
              emailVerifiedAt: wpUser.user_registered,
              createdAt: wpUser.user_registered,
              wallet: { create: { balance: 0 } },
            },
          });
      existing ? summary.skipped++ : summary.created++;

      const roleId = isAdmin ? adminRole.id : memberRole.id;
      await ctx.prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        update: {},
        create: { userId: user.id, roleId },
      });

      ctx.maps.userIdToNewId.set(wpUser.ID, user.id);
    } catch (err) {
      summary.errors.push({ ref: `user#${wpUser.ID} (${wpUser.user_email})`, message: (err as Error).message });
    }
  }
}
