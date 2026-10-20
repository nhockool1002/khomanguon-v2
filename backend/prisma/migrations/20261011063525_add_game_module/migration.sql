-- CreateEnum
CREATE TYPE "GameWinConditionType" AS ENUM ('ITEM_COLLECT', 'MONSTER_CATCH');

-- AlterEnum
ALTER TYPE "WalletTxType" ADD VALUE 'GAME_REWARD';

-- CreateTable
CREATE TABLE "game_levels" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "skyThemeKey" TEXT NOT NULL,
    "backgroundUrl" TEXT NOT NULL,
    "winConditionType" "GameWinConditionType" NOT NULL DEFAULT 'ITEM_COLLECT',
    "targetCount" INTEGER NOT NULL DEFAULT 5,
    "scrollSpeedPxS" INTEGER NOT NULL DEFAULT 120,
    "spawnIntervalMs" INTEGER NOT NULL DEFAULT 1500,
    "rewardP" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_levels_order_key" ON "game_levels"("order");
