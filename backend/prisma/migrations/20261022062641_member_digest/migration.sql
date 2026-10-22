-- CreateEnum
CREATE TYPE "MemberDigestBatchStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MemberDigestTrigger" AS ENUM ('CRON', 'MANUAL');

-- CreateEnum
CREATE TYPE "MemberDigestRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "receiveDigestEmails" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "member_digest_batches" (
    "id" TEXT NOT NULL,
    "status" "MemberDigestBatchStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" "MemberDigestTrigger" NOT NULL DEFAULT 'CRON',
    "contentSnapshot" JSONB NOT NULL,
    "newPostCount" INTEGER NOT NULL DEFAULT 0,
    "mostViewedCount" INTEGER NOT NULL DEFAULT 0,
    "mostDownloadedCount" INTEGER NOT NULL DEFAULT 0,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "member_digest_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_digest_recipients" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "MemberDigestRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "member_digest_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_digest_recipients_batchId_status_idx" ON "member_digest_recipients"("batchId", "status");

-- AddForeignKey
ALTER TABLE "member_digest_recipients" ADD CONSTRAINT "member_digest_recipients_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "member_digest_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_digest_recipients" ADD CONSTRAINT "member_digest_recipients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
