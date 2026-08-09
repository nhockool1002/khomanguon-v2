import { existsSync, mkdirSync } from 'fs';
import { join, sep } from 'path';
import { randomUUID } from 'crypto';
import type { Request } from 'express';

export const UPLOAD_ROOT = join(process.cwd(), 'uploads');
export const MEDIA_ROOT = join(UPLOAD_ROOT, 'posts');

// Prefix key dùng chung cho ảnh Thư viện Media trên bucket R2/S3 (media.service.ts) — khớp đúng
// convention thư mục "posts/yyyy/mm/dd" của local, và là điều kiện cloud-files.service.ts dùng để
// loại các file này khỏi trang "Quản lý File Cloud" (giống cách BACKUP_OBJECT_KEY_PREFIX đang làm).
export const MEDIA_KEY_PREFIX = 'posts/';

function datedPathSegments(): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return join(yyyy, mm, dd);
}

// Thư mục theo ngày kiểu WordPress (wp-content/uploads/yyyy/mm) — "posts" là gốc chung duy nhất
// cho MỌI ảnh upload local (nội dung bài viết, thumbnail, avatar, banner cài đặt chung, Thư viện
// Media khi chọn nguồn Local...) vì đây chỉ có 1 endpoint upload ảnh chung (UploadsController) —
// Thư viện Media quét thẳng cây thư mục này (xem media/media.service.ts) nên mọi nơi dùng chung 1
// hàm tạo đường dẫn để khỏi lệch.
export function datedUploadDestination(
  _req: Request,
  _file: Express.Multer.File,
  callback: (error: Error | null, destination: string) => void,
) {
  const dir = join(MEDIA_ROOT, datedPathSegments());
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  callback(null, dir);
}

// Biến thể không đụng filesystem của datedUploadDestination — dùng cho nhánh tải lên Cloud (R2/S3)
// trong media.controller.ts, nơi không có "đĩa cục bộ" để multer ghi vào. Trả về logical key
// (không có prefix bucket riêng của Provider — R2ClientService tự cộng uploadPrefix khi gọi API
// thật, xem r2-client.service.ts toPrefixedKey), khớp đúng convention posts/yyyy/mm/dd/<uuid>.ext.
// Nhận thẳng "ext" (vd ".webp") thay vì originalName — pipeline ảnh có thể đổi định dạng gốc (luôn
// ra .webp trừ .gif giữ nguyên để bảo toàn animation, xem image-pipeline.util.ts) nên key phải theo
// đúng đuôi file THẬT SỰ sẽ lưu, không phải đuôi file người dùng tải lên.
export function buildDatedKey(ext: string): string {
  return join(MEDIA_KEY_PREFIX, datedPathSegments(), `${randomUUID()}${ext}`)
    .split(sep)
    .join('/');
}
