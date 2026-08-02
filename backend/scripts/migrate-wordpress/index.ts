// ETL migrate dữ liệu WordPress v1 (sql_khomanguon_c.sql) -> khomanguon v2.
// Xem hướng dẫn chạy đầy đủ (biến môi trường, docker-compose.migrate.yml) trong
// backend/scripts/migrate-wordpress/README.md.
//
// Cách chạy:
//   pnpm run migrate:wp -- --dry-run              # chỉ đọc + in báo cáo, không ghi gì
//   pnpm run migrate:wp                            # chạy thật, tất cả các bước
//   pnpm run migrate:wp -- --only=posts,comments   # chạy thật, chỉ 2 bước chỉ định

import { PrismaClient } from '@prisma/client';
import { WpSource } from './mysql-source';
import { Report } from './report';
import { createMaps, type MigrationContext } from './context';
import { migrateUsers } from './steps/users';
import { migrateTaxonomy } from './steps/taxonomy';
import { migrateAttachments } from './steps/attachments';
import { migratePosts } from './steps/posts';
import { migrateDownloadLinks, migrateDownloadEvents } from './steps/download-links';
import { migrateWalletBalances, migrateWalletHistory } from './steps/wallet';
import { migrateComments } from './steps/comments';

const STEP_IDS = ['users', 'taxonomy', 'attachments', 'posts', 'download-links', 'wallet', 'comments'] as const;
type StepId = (typeof STEP_IDS)[number];

function parseArgs(argv: string[]) {
  const dryRun = argv.includes('--dry-run');
  const onlyArg = argv.find((a) => a.startsWith('--only='));
  const only = onlyArg
    ? (onlyArg
        .slice('--only='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as StepId[])
    : null;
  if (only) {
    for (const id of only) {
      if (!STEP_IDS.includes(id)) {
        throw new Error(`--only chứa step không hợp lệ: "${id}". Hợp lệ: ${STEP_IDS.join(', ')}`);
      }
    }
  }
  return { dryRun, only };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường bắt buộc: ${name}`);
  return value;
}

async function runStep(id: StepId, ctx: MigrationContext): Promise<void> {
  switch (id) {
    case 'users':
      return migrateUsers(ctx);
    case 'taxonomy':
      return migrateTaxonomy(ctx);
    case 'attachments':
      return migrateAttachments(ctx);
    case 'posts':
      return migratePosts(ctx);
    case 'download-links': {
      const postIdToDownloadLinkId = await migrateDownloadLinks(ctx);
      await migrateDownloadEvents(ctx, postIdToDownloadLinkId);
      return;
    }
    case 'wallet':
      await migrateWalletBalances(ctx);
      await migrateWalletHistory(ctx);
      return;
    case 'comments':
      return migrateComments(ctx);
  }
}

async function main(): Promise<void> {
  const { dryRun, only } = parseArgs(process.argv.slice(2));
  const stepsToRun = only ?? STEP_IDS;

  const wp = WpSource.connect({
    host: process.env.WP_MYSQL_HOST ?? 'localhost',
    port: Number(process.env.WP_MYSQL_PORT ?? 3307),
    user: process.env.WP_MYSQL_USER ?? 'root',
    password: process.env.WP_MYSQL_PASSWORD ?? 'migrate_root_pass',
    database: process.env.WP_MYSQL_DATABASE ?? 'khomanguon_wp',
  });
  const prisma = new PrismaClient();

  const ctx: MigrationContext = {
    wp,
    prisma,
    dryRun,
    report: new Report(),
    maps: createMaps(),
    pictureDir: requireEnv('WP_PICTURE_DIR'),
    uploadsDir: process.env.WP_UPLOADS_DIR ?? `${process.cwd()}/uploads`,
    apiBaseUrl: process.env.WP_API_BASE_URL ?? 'http://localhost:4000',
  };

  console.log(`Bắt đầu migrate — mode: ${dryRun ? 'DRY-RUN' : 'THẬT'}, steps: ${stepsToRun.join(', ')}`);

  try {
    for (const stepId of stepsToRun) {
      console.log(`\n▶ ${stepId}...`);
      await runStep(stepId, ctx);
    }
  } finally {
    ctx.report.print(dryRun);
    await prisma.$disconnect();
    await wp.close();
  }
}

main().catch((err) => {
  console.error('Migration thất bại:', err);
  process.exit(1);
});
