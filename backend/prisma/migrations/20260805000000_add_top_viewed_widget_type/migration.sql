-- Thêm loại widget "Top bài viết xem nhiều" (TOP_VIEWED). Chỉ 1 câu lệnh ALTER TYPE trong file này
-- — Postgres không cho phép dùng enum value mới thêm trong cùng transaction/migration đã thêm nó.
ALTER TYPE "WidgetType" ADD VALUE 'TOP_VIEWED';
