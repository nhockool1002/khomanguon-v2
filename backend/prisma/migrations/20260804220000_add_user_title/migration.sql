-- AlterTable
ALTER TABLE "users" ADD COLUMN "title" TEXT,
ADD COLUMN "titleUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "roles" ADD COLUMN "userTitleCooldownDays" INTEGER DEFAULT 60,
ADD COLUMN "userTitleAllowHtml" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "userTitleMaxLength" INTEGER NOT NULL DEFAULT 150;

-- Baseline ALTER TABLE ở trên áp 60 ngày / không HTML / 150 ký tự cho MỌI role đang có, kể cả
-- Admin/Super Moderator — phải nới riêng ngay trong migration này để không có khoảng hở giữa lúc
-- deploy xong và lúc Admin vào tay chỉnh lại qua UI (/quan-tri/vai-tro). Member giữ nguyên baseline
-- (đúng luôn với yêu cầu 60 ngày/150 ký tự nên không cần UPDATE riêng).
UPDATE "roles" SET "userTitleCooldownDays" = 30 WHERE "slug" = 'moderator';
UPDATE "roles" SET "userTitleCooldownDays" = NULL, "userTitleAllowHtml" = true, "userTitleMaxLength" = 500 WHERE "slug" IN ('super-moderator', 'admin');
