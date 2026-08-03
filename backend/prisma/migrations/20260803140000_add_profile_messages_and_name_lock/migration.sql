-- AlterTable
ALTER TABLE "users" ADD COLUMN "displayNameChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "profile_messages" (
    "id" TEXT NOT NULL,
    "profileUserId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_messages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "profile_messages" ADD CONSTRAINT "profile_messages_profileUserId_fkey" FOREIGN KEY ("profileUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_messages" ADD CONSTRAINT "profile_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
