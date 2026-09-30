-- CreateEnum
CREATE TYPE "IntlTopupStatus" AS ENUM ('AWAITING_PAYMENT', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'INTL_TOPUP_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'INTL_TOPUP_REJECTED';

-- AlterEnum
ALTER TYPE "WalletTxType" ADD VALUE 'INTL_TOPUP';

-- CreateTable
CREATE TABLE "intl_topup_packages" (
    "id" TEXT NOT NULL,
    "amountUsd" INTEGER NOT NULL,
    "amountP" INTEGER NOT NULL,
    "bmcExtraUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intl_topup_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intl_topup_orders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountUsd" INTEGER NOT NULL,
    "amountP" INTEGER NOT NULL,
    "status" "IntlTopupStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "termsIp" TEXT,
    "payerEmail" TEXT,
    "paidClaimedAt" TIMESTAMP(3),
    "receivedUsdCents" INTEGER,
    "creditedP" INTEGER,
    "bmcTransactionRef" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "invoiceNumber" TEXT,
    "walletTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intl_topup_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "intl_topup_orders_code_key" ON "intl_topup_orders"("code");

-- CreateIndex
CREATE UNIQUE INDEX "intl_topup_orders_invoiceNumber_key" ON "intl_topup_orders"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "intl_topup_orders_walletTransactionId_key" ON "intl_topup_orders"("walletTransactionId");

-- CreateIndex
CREATE INDEX "intl_topup_orders_userId_status_idx" ON "intl_topup_orders"("userId", "status");

-- CreateIndex
CREATE INDEX "intl_topup_orders_status_createdAt_idx" ON "intl_topup_orders"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "intl_topup_orders" ADD CONSTRAINT "intl_topup_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intl_topup_orders" ADD CONSTRAINT "intl_topup_orders_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intl_topup_orders" ADD CONSTRAINT "intl_topup_orders_walletTransactionId_fkey" FOREIGN KEY ("walletTransactionId") REFERENCES "wallet_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Gói mặc định: $P = USD × 27.000 (tỉ giá USD→VNĐ) ÷ 100 (tỉ giá cơ bản VNĐ/$P của SePay) —
-- Admin chỉnh lại ở "Cài đặt thanh toán quốc tế".
INSERT INTO "intl_topup_packages" ("id", "amountUsd", "amountP", "sortOrder") VALUES
  ('intl_pkg_default_10', 10, 2700, 0),
  ('intl_pkg_default_20', 20, 5400, 1),
  ('intl_pkg_default_50', 50, 13500, 2),
  ('intl_pkg_default_100', 100, 27000, 3);
