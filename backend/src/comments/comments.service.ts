import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

const commentSelect = {
  id: true,
  postId: true,
  parentId: true,
  content: true,
  status: true,
  pinned: true,
  createdAt: true,
  user: { select: { id: true, displayName: true, avatarUrl: true } },
  _count: { select: { likes: true } },
} satisfies Prisma.CommentSelect;

type CommentRow = Prisma.CommentGetPayload<{ select: typeof commentSelect }>;

const adminCommentSelect = {
  ...commentSelect,
  post: { select: { id: true, title: true, slug: true } },
} satisfies Prisma.CommentSelect;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Công khai — chỉ bình luận đã duyệt (UC07, wireframe #03).
  async list(postId: string, currentUserId?: string) {
    const comments = await this.prisma.comment.findMany({
      where: { postId, status: CommentStatus.PUBLISHED },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'asc' }],
      select: commentSelect,
    });
    return this.attachLikedByMe(comments, currentUserId);
  }

  // Cho Moderator — thấy cả bình luận ẩn/chờ duyệt để kiểm duyệt ngay trên trang bài viết (UC08).
  async listForModeration(postId: string, currentUserId?: string) {
    const comments = await this.prisma.comment.findMany({
      where: { postId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'asc' }],
      select: commentSelect,
    });
    return this.attachLikedByMe(comments, currentUserId);
  }

  // Trang quản trị "Quản lý bình luận" — kiểm duyệt xuyên suốt tất cả bài viết, khác
  // listForModeration() vốn chỉ xem được từng bài viết một (dùng ngay trên trang bài viết đó).
  async listAllForModeration(
    page: number,
    limit: number,
    status?: CommentStatus,
  ) {
    const take = Math.min(Math.max(limit, 1), 50);
    const skip = (Math.max(page, 1) - 1) * take;
    const where = status ? { status } : undefined;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: adminCommentSelect,
      }),
      this.prisma.comment.count({ where }),
    ]);
    return { items: rows.map((c) => this.stripCount(c)), total };
  }

  async create(userId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: dto.postId },
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');

    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent || parent.postId !== dto.postId) {
        throw new BadRequestException('Bình luận cha không hợp lệ');
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        postId: dto.postId,
        userId,
        content: dto.content,
        parentId: dto.parentId,
      },
      select: commentSelect,
    });
    return { ...this.stripCount(comment), likedByMe: false };
  }

  async toggleLike(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Không tìm thấy bình luận');

    const existing = await this.prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });
    if (existing) {
      await this.prisma.commentLike.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.commentLike.create({ data: { commentId, userId } });
    }

    const likeCount = await this.prisma.commentLike.count({
      where: { commentId },
    });
    return { commentId, likeCount, likedByMe: !existing };
  }

  async updateStatus(id: string, status: CommentStatus) {
    await this.assertExists(id);
    const comment = await this.prisma.comment.update({
      where: { id },
      data: { status },
      select: commentSelect,
    });
    return { ...this.stripCount(comment), likedByMe: false };
  }

  async setPinned(id: string, pinned: boolean) {
    await this.assertExists(id);
    const comment = await this.prisma.comment.update({
      where: { id },
      data: { pinned },
      select: commentSelect,
    });
    return { ...this.stripCount(comment), likedByMe: false };
  }

  // Xoá bình luận cha kéo theo xoá hết trả lời (onDelete: Cascade trên self-relation trong schema).
  async remove(id: string): Promise<void> {
    await this.assertExists(id);
    await this.prisma.comment.delete({ where: { id } });
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.comment.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Không tìm thấy bình luận');
  }

  private stripCount<T extends { _count: { likes: number } }>(comment: T) {
    const { _count, ...rest } = comment;
    return { ...rest, likeCount: _count.likes };
  }

  private async attachLikedByMe(
    comments: CommentRow[],
    currentUserId?: string,
  ) {
    const likedSet = new Set<string>();
    if (currentUserId && comments.length > 0) {
      const likes = await this.prisma.commentLike.findMany({
        where: {
          userId: currentUserId,
          commentId: { in: comments.map((c) => c.id) },
        },
        select: { commentId: true },
      });
      for (const like of likes) likedSet.add(like.commentId);
    }
    return comments.map((c) => ({
      ...this.stripCount(c),
      likedByMe: likedSet.has(c.id),
    }));
  }
}
