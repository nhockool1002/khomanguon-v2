-- CreateEnum
CREATE TYPE "CloudUploadStatus" AS ENUM ('SUCCESS', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "cloud_upload_records" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "objectKey" TEXT,
    "folder" TEXT,
    "sizeBytes" BIGINT,
    "status" "CloudUploadStatus" NOT NULL,
    "errorMessage" TEXT,
    "storageProviderId" TEXT,
    "providerLabel" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cloud_upload_records_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cloud_upload_records" ADD CONSTRAINT "cloud_upload_records_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
