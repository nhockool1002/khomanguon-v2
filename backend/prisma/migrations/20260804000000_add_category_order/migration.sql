-- Thêm cột order để hỗ trợ kéo-thả sắp xếp danh mục (giống Menu.order), mặc định 0 cho danh mục cũ.
ALTER TABLE "categories" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
