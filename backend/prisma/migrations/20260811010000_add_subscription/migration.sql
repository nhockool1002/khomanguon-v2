-- AlterEnum
ALTER TYPE "UserActivityType" ADD VALUE 'SUBSCRIPTION_PURCHASED';

-- CreateEnum
CREATE TYPE "SubscriptionOrderStatus" AS ENUM ('PENDING', 'SUCCESS', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionMembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED');

-- AlterTable
ALTER TABLE "download_events" ADD COLUMN "subscriptionMembershipId" TEXT;

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "priceVnd" INTEGER NOT NULL,
    "totalDownloadLimit" INTEGER,
    "dailyDownloadLimit" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "status" "SubscriptionOrderStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "orderId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_sepay_transactions" (
    "id" TEXT NOT NULL,
    "sepayTransactionCode" TEXT NOT NULL,
    "subscriptionOrderId" TEXT,
    "amountVnd" INTEGER NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "status" "WalletTxStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_sepay_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_sepay_transactions_sepayTransactionCode_key" ON "subscription_sepay_transactions"("sepayTransactionCode");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_orders_code_key" ON "subscription_orders"("code");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_memberships_orderId_key" ON "subscription_memberships"("orderId");

-- CreateIndex
CREATE INDEX "subscription_memberships_userId_status_idx" ON "subscription_memberships"("userId", "status");

-- CreateIndex
CREATE INDEX "download_events_subscriptionMembershipId_downloadLinkId_idx" ON "download_events"("subscriptionMembershipId", "downloadLinkId");

-- CreateIndex
CREATE INDEX "download_events_subscriptionMembershipId_createdAt_idx" ON "download_events"("subscriptionMembershipId", "createdAt");

-- AddForeignKey
ALTER TABLE "subscription_orders" ADD CONSTRAINT "subscription_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_orders" ADD CONSTRAINT "subscription_orders_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_memberships" ADD CONSTRAINT "subscription_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_memberships" ADD CONSTRAINT "subscription_memberships_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_memberships" ADD CONSTRAINT "subscription_memberships_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "subscription_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_events" ADD CONSTRAINT "download_events_subscriptionMembershipId_fkey" FOREIGN KEY ("subscriptionMembershipId") REFERENCES "subscription_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
