-- CreateEnum
CREATE TYPE "LinkReportStatus" AS ENUM ('PENDING', 'RESOLVED');

-- CreateTable
CREATE TABLE "link_reports" (
    "id" TEXT NOT NULL,
    "downloadLinkId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "note" TEXT,
    "status" "LinkReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_reports_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "link_reports" ADD CONSTRAINT "link_reports_downloadLinkId_fkey" FOREIGN KEY ("downloadLinkId") REFERENCES "download_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_reports" ADD CONSTRAINT "link_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_reports" ADD CONSTRAINT "link_reports_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
