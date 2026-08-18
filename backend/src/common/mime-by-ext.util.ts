import { extname } from 'path';

// Đoán mimetype từ đuôi file — dùng khi nguồn dữ liệu chỉ có tên/đường dẫn file (không có
// Content-Type thật, vd quét đĩa/bucket ở media.service.ts, hoặc ảnh pdftohtml tự sinh ra ở
// content-import.service.ts). Chỉ phủ các định dạng ảnh mà pipeline của app xử lý được.
const IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export function guessImageMimeType(fileNameOrPath: string): string {
  return (
    IMAGE_MIME_BY_EXT[extname(fileNameOrPath).toLowerCase()] ??
    'application/octet-stream'
  );
}
