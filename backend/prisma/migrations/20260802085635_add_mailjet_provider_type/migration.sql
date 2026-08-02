-- AlterEnum
ALTER TYPE "StorageProviderType" ADD VALUE 'MAILJET';

-- AlterTable
ALTER TABLE "storage_providers" ALTER COLUMN "bucket" DROP NOT NULL;
