-- AlterEnum: Admin có thể thu hồi (revoke) gói Subscription của user trước hạn — phân biệt với
-- EXPIRED (tự hết hạn do cron).
ALTER TYPE "SubscriptionMembershipStatus" ADD VALUE 'REVOKED';

-- AlterEnum: audit log cho thao tác revoke ở trên.
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_REVOKED';
