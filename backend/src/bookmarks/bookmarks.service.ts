import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { listSelect, mapPost } from '../posts/posts.service';

// "Lưu bài viết" — toggle qua PostBookmark.postId_userId unique, cùng pattern
// CommentsService.toggleLike(). KHÔNG dùng @Cacheable ở bất kỳ route nào gọi service này (trạng
// thái theo từng user, cache chung sẽ lộ/lẫn giữa các user — đúng bài học đã rút ra ở
// HttpCacheInterceptor/PublicRateLimitService).
@Injectable()
export class BookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  async toggle(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');

    const existing = await this.prisma.postBookmark.findUnique({
      where: { postId_userId: { postId, userId } },
    });
    if (existing) {
      await this.prisma.postBookmark.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.postBookmark.create({ data: { postId, userId } });
    }
    return { postId, bookmarked: !existing };
  }

  async getStatus(userId: string | undefined, postId: string) {
    if (!userId) return { postId, bookmarked: false };
    const existing = await this.prisma.postBookmark.findUnique({
      where: { postId_userId: { postId, userId } },
    });
    return { postId, bookmarked: !!existing };
  }

  async listMine(userId: string, page: number, limit: number) {
    const take = Math.min(Math.max(limit, 1), 50);
    const skip = (Math.max(page, 1) - 1) * take;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.postBookmark.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: { createdAt: true, post: { select: listSelect } },
      }),
      this.prisma.postBookmark.count({ where: { userId } }),
    ]);
    return {
      items: rows.map((r) => ({
        ...mapPost(r.post),
        bookmarkedAt: r.createdAt,
      })),
      total,
    };
  }
}
