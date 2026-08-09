import { promises as fs } from 'fs';
import { basename, extname, join, relative, sep } from 'path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { R2ClientService } from '../storage/r2-client.service';
import {
  MEDIA_KEY_PREFIX,
  MEDIA_ROOT,
  UPLOAD_ROOT,
} from '../common/dated-upload.util';

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export interface MediaFileEntry {
  // Local: đường dẫn tương đối (từ /uploads). Cloud: object key thật trên bucket (luôn bắt đầu
  // "posts/..."). Dùng làm id vì cả 2 nguồn đều liệt kê trực tiếp từ nơi lưu trữ thật, không phải
  // từ 1 bảng có primary key riêng (xem lý do quét đĩa/bucket ở list() bên dưới).
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
  // Không truyền/rỗng = Local (hành vi gốc, quét đĩa). Có giá trị = id 1 StorageProvider R2/S3.
  storageProviderId?: string;
}

function toRelPath(absolutePath: string): string {
  return relative(UPLOAD_ROOT, absolutePath).split(sep).join('/');
}

function guessMimeType(key: string): string {
  return (
    IMAGE_MIME_BY_EXT[extname(key).toLowerCase()] ?? 'application/octet-stream'
  );
}

// Thư viện Media (kiểu WordPress) — Local quét trực tiếp cây thư mục đĩa uploads/posts/yyyy/mm/dd
// thay vì dựa vào 1 bảng DB để liệt kê: ảnh có thể tới từ nhiều nguồn khác nhau cùng ghi vào cây
// thư mục này (trình soạn bài viết/avatar/banner qua UploadsController, hoặc chính thư viện Media
// này) nên quét đĩa là cách duy nhất đảm bảo luôn thấy đủ. Cloud (R2/S3) áp dụng đúng triết lý này —
// liệt kê object THẬT trong bucket (r2Client.listObjects) thay vì tin vào 1 bảng DB có thể lệch nếu
// object bị xoá/thêm ngoài luồng app. Bảng MediaFile ở cả 2 trường hợp chỉ dùng để bổ sung tên
// gốc/người tải lên khi ảnh được tải qua chính endpoint /media, không phải nguồn liệt kê chính.
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Client: R2ClientService,
  ) {}

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
    if (params.storageProviderId) {
      return this.listCloud(params.storageProviderId, params);
    }
    return this.listLocal(params);
  }

  private async listLocal(
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
        mimeType: guessMimeType(relPath),
        createdAt: stat.mtime.toISOString(),
        uploadedBy: dbRow?.uploadedBy ?? null,
      };
    });

    return { items, total };
  }

  private async listCloud(
    storageProviderId: string,
    params: ListMediaParams,
  ): Promise<{ items: MediaFileEntry[]; total: number }> {
    const provider = await this.prisma.storageProvider.findUnique({
      where: { id: storageProviderId },
      select: { publicBaseUrl: true },
    });
    if (!provider?.publicBaseUrl) {
      throw new NotFoundException(
        'Storage provider chưa cấu hình publicBaseUrl — không dùng được cho Thư viện Media',
      );
    }
    const publicBase = provider.publicBaseUrl.replace(/\/+$/, '');

    const objects = await this.r2Client.listObjects(
      storageProviderId,
      MEDIA_KEY_PREFIX,
    );

    const fileNames = objects.map((o) => basename(o.key));
    const dbRows = fileNames.length
      ? await this.prisma.mediaFile.findMany({
          where: { storageProviderId, fileName: { in: fileNames } },
          select: {
            fileName: true,
            originalName: true,
            uploadedBy: { select: { displayName: true } },
          },
        })
      : [];
    const dbByFileName = new Map(dbRows.map((r) => [r.fileName, r]));

    const q = params.q?.trim().toLowerCase();
    const filtered = q
      ? objects.filter((o) => {
          const displayName =
            dbByFileName.get(basename(o.key))?.originalName ?? basename(o.key);
          return displayName.toLowerCase().includes(q);
        })
      : objects;

    filtered.sort(
      (a, b) =>
        (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0),
    );

    const total = filtered.length;
    const take = Math.min(Math.max(params.limit ?? 24, 1), 60);
    const skip = (Math.max(params.page ?? 1, 1) - 1) * take;
    const page = filtered.slice(skip, skip + take);

    const items: MediaFileEntry[] = page.map((obj) => {
      const fileName = basename(obj.key);
      const dbRow = dbByFileName.get(fileName);
      return {
        path: obj.key,
        url: `${publicBase}/${obj.key}`,
        fileName: dbRow?.originalName ?? fileName,
        sizeBytes: obj.sizeBytes,
        mimeType: guessMimeType(obj.key),
        createdAt: (obj.lastModified ?? new Date()).toISOString(),
        uploadedBy: dbRow?.uploadedBy ?? null,
      };
    });

    return { items, total };
  }

  // "key" luôn theo cấu trúc "posts/yyyy/mm/dd/<uuid>.ext" (xem buildDatedKey trong
  // dated-upload.util.ts) dù Local hay Cloud — Local ghi vào UPLOAD_ROOT/<key> trên đĩa, Cloud ghi
  // lên bucket đúng key đó, chỉ khác cách tính "url" cuối cùng.
  async record(params: {
    key: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedById: string;
    storageProviderId?: string;
  }): Promise<void> {
    const {
      key,
      originalName,
      mimeType,
      sizeBytes,
      uploadedById,
      storageProviderId,
    } = params;
    let url: string;
    if (storageProviderId) {
      const provider = await this.prisma.storageProvider.findUnique({
        where: { id: storageProviderId },
        select: { publicBaseUrl: true },
      });
      const publicBase = provider?.publicBaseUrl?.replace(/\/+$/, '') ?? '';
      url = `${publicBase}/${key}`;
    } else {
      url = `/uploads/${key}`;
    }

    await this.prisma.mediaFile.create({
      data: {
        fileName: basename(key),
        originalName,
        mimeType,
        sizeBytes,
        url,
        uploadedById,
        storageProviderId,
      },
    });
  }

  // Pass-through mỏng cho controller (giữ nguyên chỗ duy nhất gọi R2ClientService trong module này
  // là qua MediaService, không tiêm thẳng R2ClientService vào MediaController).
  async putCloudObject(
    storageProviderId: string,
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.r2Client.putObject(storageProviderId, key, buffer, contentType);
  }

  async remove(path: string, storageProviderId?: string): Promise<void> {
    if (storageProviderId) {
      if (!path.startsWith(MEDIA_KEY_PREFIX)) {
        throw new NotFoundException('Đường dẫn không hợp lệ');
      }
      await this.r2Client.deleteObject(storageProviderId, path);
      await this.prisma.mediaFile.deleteMany({
        where: { storageProviderId, fileName: basename(path) },
      });
      return;
    }

    const target = join(UPLOAD_ROOT, path);
    // Chặn path traversal (vd "../../etc/passwd") — chỉ cho xoá file thật sự nằm trong uploads/posts.
    if (!target.startsWith(MEDIA_ROOT + sep)) {
      throw new NotFoundException('Đường dẫn không hợp lệ');
    }
    await fs.rm(target, { force: true });
    await this.prisma.mediaFile.deleteMany({
      where: { url: `/uploads/${path}` },
    });
  }
}
