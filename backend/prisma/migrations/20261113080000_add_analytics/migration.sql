-- CreateTable
CREATE TABLE "site_visits" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "path" TEXT NOT NULL,
    "referrerHost" TEXT,
    "userId" TEXT,

    CONSTRAINT "site_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_view_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postId" TEXT NOT NULL,

    CONSTRAINT "post_view_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_visits_createdAt_idx" ON "site_visits"("createdAt");

-- CreateIndex
CREATE INDEX "site_visits_referrerHost_createdAt_idx" ON "site_visits"("referrerHost", "createdAt");

-- CreateIndex
CREATE INDEX "post_view_logs_postId_createdAt_idx" ON "post_view_logs"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "post_view_logs_createdAt_idx" ON "post_view_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_view_logs" ADD CONSTRAINT "post_view_logs_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
