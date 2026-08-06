import { randomUUID } from 'crypto';
import { unlink, stat } from 'fs/promises';
import { dirname } from 'path';
import sharp from 'sharp';

const RESIZABLE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const RESIZE_MAX_WIDTH = 1920;
const WEBP_QUALITY = 82;

// Resize + convert ảnh JPEG/PNG/WebP đã upload (multer diskStorage) sang WebP tối ưu (PLAN.md 4.2)
// — bỏ qua GIF vì resize tĩnh sẽ mất animation, giữ nguyên file gốc cho loại này. Dùng chung cho cả
// UploadsController và MediaController — 2 endpoint upload ảnh duy nhất trong hệ thống (nội dung bài
// viết/avatar/banner qua /uploads, Thư viện Media qua /media), mỗi nơi tự có multer config riêng
// nên không thể gộp thành 1 middleware chung, nhưng bước xử lý ảnh sau khi multer ghi file thì dùng
// chung được ở đây. Mutate thẳng object `file` (path/filename/mimetype/size) để mọi nơi đọc lại
// file sau khi gọi hàm này (media.service.ts record(), response trả URL...) thấy đúng file thật đã
// lưu trên đĩa, không phải file gốc đã bị xoá.
export async function processUploadedImage(
  file: Express.Multer.File,
): Promise<void> {
  if (!RESIZABLE_MIME_TYPES.has(file.mimetype)) return;

  const webpFilename = `${randomUUID()}.webp`;
  const webpPath = `${dirname(file.path)}/${webpFilename}`;
  await sharp(file.path)
    .resize({ width: RESIZE_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(webpPath);
  await unlink(file.path);

  const { size } = await stat(webpPath);
  file.path = webpPath;
  file.filename = webpFilename;
  file.mimetype = 'image/webp';
  file.size = size;
}
