import { promises as fs } from 'fs';
import { join } from 'path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

export interface ListMediaParams {
  q?: string;
  page?: number;
  limit?: number;
}

// Thư viện Media (kiểu WordPress) — mọi upload qua controller này được ghi 1 dòng MediaFile để
// liệt kê/tìm kiếm theo tên gốc; file vật lý vẫn nằm chung ./uploads với /uploads cũ (UploadsModule).
@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  async record(file: Express.Multer.File, uploadedById: string) {
    return this.prisma.mediaFile.create({
      data: {
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        url: `/uploads/${file.filename}`,
        uploadedById,
      },
    });
  }

  async list(params: ListMediaParams) {
    const take = Math.min(Math.max(params.limit ?? 24, 1), 60);
    const skip = (Math.max(params.page ?? 1, 1) - 1) * take;
    const where: Prisma.MediaFileWhereInput = params.q
      ? {
          originalName: {
            contains: params.q,
            mode: Prisma.QueryMode.insensitive,
          },
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.mediaFile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { uploadedBy: { select: { displayName: true } } },
      }),
      this.prisma.mediaFile.count({ where }),
    ]);
    return { items, total };
  }

  async remove(id: string): Promise<void> {
    const file = await this.prisma.mediaFile.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('Không tìm thấy tệp media');
    // force: true — bỏ qua nếu file vật lý đã bị xoá tay trước đó, ưu tiên dọn sạch bản ghi DB.
    await fs.rm(join(UPLOAD_DIR, file.fileName), { force: true });
    await this.prisma.mediaFile.delete({ where: { id } });
  }
}
