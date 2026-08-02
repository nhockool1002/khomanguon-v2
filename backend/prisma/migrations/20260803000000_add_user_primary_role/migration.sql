-- AlterTable
ALTER TABLE "users" ADD COLUMN "primaryRoleId" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_primaryRoleId_fkey" FOREIGN KEY ("primaryRoleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
