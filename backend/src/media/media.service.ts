import { promises as fs } from 'fs';
import { basename, extname, join, relative, sep } from 'path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MEDIA_ROOT, UPLOAD_ROOT } from '../common/dated-upload.util';

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export interface MediaFileEntry {
  // Đường dẫn tương đối (từ /uploads) — dùng làm id vì Thư viện Media liệt kê trực tiếp từ đĩa,
  // không phải từ 1 bảng có primary key riêng (xem lý do quét đĩa ở list() bên dưới).
  path: string;
  url: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
  uploadedBy: { displayName: string } | null;
}

export interface ListMediaParams {
  q?: string;
  page?: number;
  limit?: number;
}

function toRelPath(absolutePath: string): string {
  return relative(UPLOAD_ROOT, absolutePath).split(sep).join('/');
}

// Thư viện Media (kiểu WordPress) — quét trực tiếp cây thư mục đĩa uploads/posts/yyyy/mm/dd thay vì
// dựa vào 1 bảng DB để liệt kê: ảnh có thể tới từ nhiều nguồn khác nhau cùng ghi vào cây thư mục này
// (trình soạn bài viết/avatar/banner qua UploadsController, hoặc chính thư viện Media này) nên quét
// đĩa là cách duy nhất đảm bảo luôn thấy đủ. Bảng MediaFile chỉ dùng để bổ sung tên gốc/người tải
// lên khi ảnh được tải qua chính endpoint /media (không phải nguồn liệt kê chính).
@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  private async walk(dir: string): Promise<string[]> {
    let entries: import('fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const files: string[] = [];
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.walk(full)));
      } else if (IMAGE_MIME_BY_EXT[extname(entry.name).toLowerCase()]) {
        files.push(full);
      }
    }
    return files;
  }

  async list(
    params: ListMediaParams,
  ): Promise<{ items: MediaFileEntry[]; total: number }> {
    const absolutePaths = await this.walk(MEDIA_ROOT);
    const relPaths = absolutePaths.map(toRelPath);

    // Lấy trước metadata DB (originalName/uploadedBy) cho TOÀN BỘ file tìm thấy trên đĩa (không
    // chỉ 1 trang) — cần thiết vì bộ lọc q phải so khớp theo tên hiển thị (originalName khi có),
    // không phải tên file UUID vật lý, nếu không search sẽ không tìm ra file có tên gốc dễ đọc.
    const allUrls = relPaths.map((p) => `/uploads/${p}`);
    const dbRows = allUrls.length
      ? await this.prisma.mediaFile.findMany({
          where: { url: { in: allUrls } },
          select: {
            url: true,
            originalName: true,
            uploadedBy: { select: { displayName: true } },
          },
        })
      : [];
    const dbByUrl = new Map(dbRows.map((r) => [r.url, r]));

    const q = params.q?.trim().toLowerCase();
    const filtered = q
      ? relPaths.filter((p) => {
          const displayName =
            dbByUrl.get(`/uploads/${p}`)?.originalName ?? basename(p);
          return displayName.toLowerCase().includes(q);
        })
      : relPaths;

    const withStats = await Promise.all(
      filtered.map(async (relPath) => ({
        relPath,
        stat: await fs.stat(join(UPLOAD_ROOT, relPath)),
      })),
    );
    withStats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

    const total = withStats.length;
    const take = Math.min(Math.max(params.limit ?? 24, 1), 60);
    const skip = (Math.max(params.page ?? 1, 1) - 1) * take;
    const page = withStats.slice(skip, skip + take);

    const items: MediaFileEntry[] = page.map(({ relPath, stat }) => {
      const url = `/uploads/${relPath}`;
      const dbRow = dbByUrl.get(url);
      return {
        path: relPath,
        url,
        fileName: dbRow?.originalName ?? basename(relPath),
        sizeBytes: stat.size,
        mimeType:
          IMAGE_MIME_BY_EXT[extname(relPath).toLowerCase()] ??
          'application/octet-stream',
        createdAt: stat.mtime.toISOString(),
        uploadedBy: dbRow?.uploadedBy ?? null,
      };
    });

    return { items, total };
  }

  async record(file: Express.Multer.File, uploadedById: string): Promise<void> {
    const relPath = toRelPath(file.path);
    await this.prisma.mediaFile.create({
      data: {
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        url: `/uploads/${relPath}`,
        uploadedById,
      },
    });
  }

  async remove(relPath: string): Promise<void> {
    const target = join(UPLOAD_ROOT, relPath);
    // Chặn path traversal (vd "../../etc/passwd") — chỉ cho xoá file thật sự nằm trong uploads/posts.
    if (!target.startsWith(MEDIA_ROOT + sep)) {
      throw new NotFoundException('Đường dẫn không hợp lệ');
    }
    await fs.rm(target, { force: true });
    await this.prisma.mediaFile.deleteMany({
      where: { url: `/uploads/${relPath}` },
    });
  }
}
