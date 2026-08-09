-- AlterTable
ALTER TABLE "storage_providers" ADD COLUMN "publicBaseUrl" TEXT;

-- AlterTable
ALTER TABLE "media_files" ADD COLUMN "storageProviderId" TEXT;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_storageProviderId_fkey" FOREIGN KEY ("storageProviderId") REFERENCES "storage_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
