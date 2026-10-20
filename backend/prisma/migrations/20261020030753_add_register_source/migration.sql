-- CreateEnum
CREATE TYPE "RegisterSource" AS ENUM ('WEB', 'EXTENSION');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "registeredVia" "RegisterSource" NOT NULL DEFAULT 'WEB';
