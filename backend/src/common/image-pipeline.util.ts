import { randomUUID } from 'crypto';
import { readFile, unlink, writeFile, stat } from 'fs/promises';
import { dirname } from 'path';
import sharp from 'sharp';

const RESIZABLE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const RESIZE_MAX_WIDTH = 1920;
const WEBP_QUALITY = 82;

// mimetype -> đuôi file gốc, chỉ dùng cho trường hợp KHÔNG resize (gif) — cần biết đuôi thật để đặt
// tên file/key đúng khi bỏ qua xử lý ảnh (xem resizeToWebpBuffer bên dưới).
const PASSTHROUGH_EXT_BY_MIME: Record<string, string> = {
  'image/gif': '.gif',
};

export interface ProcessedImageBuffer {
  buffer: Buffer;
  mimetype: string;
  ext: string;
}

// Lõi resize + convert WebP dùng chung, thao tác thuần trên buffer (không đụng filesystem) — tách
// ra từ processUploadedImage() để dùng lại cho nhánh upload Cloud (media.controller.ts, không có
// "đĩa cục bộ" để ghi file tạm như multer diskStorage). Bỏ qua GIF vì resize tĩnh sẽ mất animation,
// giữ nguyên buffer gốc cho loại này.
export async function resizeToWebpBuffer(
  buffer: Buffer,
  mimetype: string,
): Promise<ProcessedImageBuffer> {
  if (!RESIZABLE_MIME_TYPES.has(mimetype)) {
    return {
      buffer,
      mimetype,
      ext: PASSTHROUGH_EXT_BY_MIME[mimetype] ?? '',
    };
  }
  const processed = await sharp(buffer)
    .resize({ width: RESIZE_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  return { buffer: processed, mimetype: 'image/webp', ext: '.webp' };
}

// Resize + convert ảnh JPEG/PNG/WebP đã upload (multer diskStorage) sang WebP tối ưu (PLAN.md 4.2)
// — dùng cho UploadsController (/uploads, nội dung bài viết/avatar/banner) và nhánh Local của
// MediaController (/media). Đọc file multer đã ghi ra đĩa vào buffer, xử lý qua resizeToWebpBuffer()
// ở trên, ghi kết quả đè lại đĩa — giữ nguyên hành vi/chữ ký cũ (mutate thẳng object `file`) để nơi
// gọi (media.service.ts record(), response trả URL...) không cần đổi gì.
export async function processUploadedImage(
  file: Express.Multer.File,
): Promise<void> {
  if (!RESIZABLE_MIME_TYPES.has(file.mimetype)) return;

  const original = await readFile(file.path);
  const { buffer, mimetype, ext } = await resizeToWebpBuffer(
    original,
    file.mimetype,
  );

  const newFilename = `${randomUUID()}${ext}`;
  const newPath = `${dirname(file.path)}/${newFilename}`;
  await writeFile(newPath, buffer);
  await unlink(file.path);

  const { size } = await stat(newPath);
  file.path = newPath;
  file.filename = newFilename;
  file.mimetype = mimetype;
  file.size = size;
}
