-- CreateEnum
CREATE TYPE "GameCharacterKey" AS ENUM ('VIKING_AXE', 'VIKING_SWORD');

-- CreateTable
CREATE TABLE "game_player_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterKey" "GameCharacterKey",
    "currentLevelOrder" INTEGER NOT NULL DEFAULT 1,
    "totalRewardP" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_player_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_player_progress_userId_key" ON "game_player_progress"("userId");

-- AddForeignKey
ALTER TABLE "game_player_progress" ADD CONSTRAINT "game_player_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
