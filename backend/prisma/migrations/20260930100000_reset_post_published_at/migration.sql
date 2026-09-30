-- Issue #65: trước bản fix, mỗi lần sửa + lưu bài đã xuất bản đều gán lại "publishedAt" = now(),
-- làm bài cũ nhảy lên đầu Trang chủ (sắp theo publishedAt) và lệch thứ tự với Trang quản trị.
-- Không có audit log cho thao tác sửa bài nên không khôi phục được thời điểm xuất bản thật —
-- đưa về "createdAt" (khớp cách script migrate-wordpress gán publishedAt = post_date = createdAt).
UPDATE "posts"
SET "publishedAt" = "createdAt"
WHERE "status" = 'PUBLISHED';
