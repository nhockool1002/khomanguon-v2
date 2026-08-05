-- CreateEnum
CREATE TYPE "UserActivityType" AS ENUM ('LOGIN', 'VIEW_POST', 'DEPOSIT', 'VISIT_PROFILE');

-- CreateTable
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserActivityType" NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_activities_userId_createdAt_idx" ON "user_activities"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
