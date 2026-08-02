-- CreateEnum
CREATE TYPE "TopupOrderStatus" AS ENUM ('PENDING', 'SUCCESS', 'EXPIRED');

-- CreateTable
CREATE TABLE "topup_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "amountP" INTEGER NOT NULL,
    "status" "TopupOrderStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "walletTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topup_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "topup_orders_code_key" ON "topup_orders"("code");

-- CreateIndex
CREATE UNIQUE INDEX "topup_orders_walletTransactionId_key" ON "topup_orders"("walletTransactionId");

-- AddForeignKey
ALTER TABLE "topup_orders" ADD CONSTRAINT "topup_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topup_orders" ADD CONSTRAINT "topup_orders_walletTransactionId_fkey" FOREIGN KEY ("walletTransactionId") REFERENCES "wallet_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
