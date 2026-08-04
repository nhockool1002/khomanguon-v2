-- Comments chưa có index nào ngoài khoá chính — trang Quản lý bình luận (ORDER BY createdAt,
-- lọc theo status) và luồng public (WHERE postId) đều đang quét toàn bảng khi bảng phình lên.
CREATE INDEX "comments_postId_createdAt_idx" ON "comments"("postId", "createdAt");
CREATE INDEX "comments_status_createdAt_idx" ON "comments"("status", "createdAt");
CREATE INDEX "comments_createdAt_idx" ON "comments"("createdAt");
