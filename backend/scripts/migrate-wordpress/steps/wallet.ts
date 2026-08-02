import { WalletTxStatus, WalletTxType } from '@prisma/client';
import type { MigrationContext } from '../context';

const MIGRATION_REFERENCE_TYPE = 'wordpress_migration';

// Đã chốt với bạn: quy đổi 1:1 point cũ -> $P. src_point là nguồn "sự thật" cho số dư hiện tại;
// src_point_history chỉ để giữ lại lịch sử tham khảo/đối soát — 2 nguồn không nhất thiết cộng khớp
// tuyệt đối (đơn nạp tiền treo, chỉnh tay ngoài lịch sử...), không coi đây là lỗi.
export async function migrateWalletBalances(ctx: MigrationContext): Promise<void> {
  const summary = ctx.report.startStep('wallet-balances');
  const points = await ctx.wp.points();
  summary.read = points.length;

  for (const row of points) {
    const userId = ctx.maps.userIdToNewId.get(row.user_id);
    if (!userId) {
      summary.errors.push({ ref: `point#${row.user_id}`, message: `Không tìm thấy user đã migrate (WP user #${row.user_id})` });
      continue;
    }
    if (ctx.dryRun) {
      summary.updated++;
      continue;
    }
    try {
      await ctx.prisma.wallet.upsert({
        where: { userId },
        update: { balance: row.point_amount },
        create: { userId, balance: row.point_amount },
      });
      summary.updated++;
    } catch (err) {
      summary.errors.push({ ref: `wallet của WP user#${row.user_id}`, message: (err as Error).message });
    }
  }
}

export async function migrateWalletHistory(ctx: MigrationContext): Promise<void> {
  const summary = ctx.report.startStep('wallet-history');
  const history = await ctx.wp.pointHistory();
  summary.read = history.length;

  const runningBalanceByUserId = new Map<number, number>();

  for (const row of history) {
    const userId = ctx.maps.userIdToNewId.get(row.user_id);
    const signedAmount = row.operation === '-' ? -Math.abs(row.amount) : Math.abs(row.amount);
    const previousBalance = runningBalanceByUserId.get(row.user_id) ?? 0;
    const balanceAfter = previousBalance + signedAmount;
    runningBalanceByUserId.set(row.user_id, balanceAfter);

    if (!userId) {
      summary.errors.push({ ref: `point_history#${row.id}`, message: `Không tìm thấy user đã migrate (WP user #${row.user_id})` });
      continue;
    }
    if (ctx.dryRun) {
      summary.created++;
      continue;
    }

    try {
      const wallet = await ctx.prisma.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId, balance: 0 },
      });

      const existing = await ctx.prisma.walletTransaction.findFirst({
        where: { walletId: wallet.id, referenceType: MIGRATION_REFERENCE_TYPE, referenceId: String(row.id) },
      });
      if (existing) {
        summary.skipped++;
        continue;
      }

      await ctx.prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: row.operation === '+' ? WalletTxType.TOPUP : WalletTxType.PURCHASE,
          amount: signedAmount,
          balanceAfter,
          status: WalletTxStatus.SUCCESS,
          referenceType: MIGRATION_REFERENCE_TYPE,
          referenceId: String(row.id),
          createdAt: row.timestamp,
        },
      });
      summary.created++;
    } catch (err) {
      summary.errors.push({ ref: `point_history#${row.id}`, message: (err as Error).message });
    }
  }
}
