-- Cột bật/tắt popup gợi ý bài viết ngẫu nhiên — mặc định bật cho user cũ.
ALTER TABLE "users" ADD COLUMN "showPostPopup" BOOLEAN NOT NULL DEFAULT true;
