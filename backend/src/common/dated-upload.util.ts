import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Request } from 'express';

export const UPLOAD_ROOT = join(process.cwd(), 'uploads');
export const MEDIA_ROOT = join(UPLOAD_ROOT, 'posts');

// Thư mục theo ngày kiểu WordPress (wp-content/uploads/yyyy/mm) — "posts" là gốc chung duy nhất
// cho MỌI ảnh upload (nội dung bài viết, thumbnail, avatar, banner cài đặt chung, thư viện Media...)
// vì đây chỉ có 1 endpoint upload ảnh chung (UploadsController) — Thư viện Media quét thẳng cây
// thư mục này (xem media/media.service.ts) nên mọi nơi dùng chung 1 hàm tạo đường dẫn để khỏi lệch.
export function datedUploadDestination(
  _req: Request,
  _file: Express.Multer.File,
  callback: (error: Error | null, destination: string) => void,
) {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dir = join(MEDIA_ROOT, yyyy, mm, dd);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  callback(null, dir);
}
