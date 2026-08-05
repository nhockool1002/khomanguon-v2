-- CreateEnum
CREATE TYPE "DbBackupStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "db_backup_records" (
    "id" TEXT NOT NULL,
    "status" "DbBackupStatus" NOT NULL,
    "sizeBytes" BIGINT,
    "storageProviderId" TEXT,
    "objectKey" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "db_backup_records_pkey" PRIMARY KEY ("id")
);
