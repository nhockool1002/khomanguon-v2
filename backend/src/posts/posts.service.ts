import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PostStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { PERMISSIONS } from '../roles/permissions.constant';
import { resolveStyleRoleSlug } from '../roles/style-role.util';
import { buildUniqueSlug } from '../common/slugify';
import { CacheService } from '../cache/cache.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

const listSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  thumbnailUrl: true,
  status: true,
  viewCount: true,
  publishedAt: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
  author: {
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      primaryRoleId: true,
      roles: {
        select: { roleId: true, role: { select: { slug: true } } },
        orderBy: { role: { createdAt: 'asc' } },
      },
    },
  },
} satisfies Prisma.PostSelect;

const detailSelect = {
  ...listSelect,
  contentHtml: true,
  metaTitle: true,
  metaDescription: true,
  ogImageUrl: true,
  canonicalUrl: true,
  categoryId: true,
  authorId: true,
  updatedAt: true,
} satisfies Prisma.PostSelect;

type PostListRow = Prisma.PostGetPayload<{ select: typeof listSelect }>;

interface PageQuery {
  page?: number;
  limit?: number;
}

function toPagination({ page = 1, limit = 12 }: PageQuery) {
  const take = Math.min(Math.max(limit, 1), 50);
  const skip = (Math.max(page, 1) - 1) * take;
  return { skip, take };
}

// Resolve author.roles + primaryRoleId -> author.styleRoleSlug cho FE style tên tác giả theo
// đúng 1 role (xem components/styled-user-name.tsx).
function mapAuthor<T extends { author: PostListRow['author'] }>(post: T) {
  const { primaryRoleId, roles, ...authorRest } = post.author;
  return {
    ...post,
    author: {
      ...authorRest,
      styleRoleSlug: resolveStyleRoleSlug(primaryRoleId, roles),
    },
  };
}

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly cache: CacheService,
  ) {}

  // "sort=popular" sắp theo viewCount — tìm kiếm dùng ILIKE trên title/excerpt (đơn giản, đủ
  // dùng ở quy mô hiện tại; nâng cấp tsvector/Meilisearch khi traffic lớn — xem PLAN.md 2.4).
  async listPublic(
    query: PageQuery & {
      categorySlug?: string;
      q?: string;
      sort?: 'newest' | 'popular';
    },
  ) {
    const { skip, take } = toPagination(query);
    const where: Prisma.PostWhereInput = {
      status: PostStatus.PUBLISHED,
      ...(query.categorySlug && { category: { slug: query.categorySlug } }),
      ...(query.q && {
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { excerpt: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };
    const orderBy: Prisma.PostOrderByWithRelationInput =
      query.sort === 'popular'
        ? { viewCount: 'desc' }
        : { publishedAt: 'desc' };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        skip,
        take,
        orderBy,
        select: listSelect,
      }),
      this.prisma.post.count({ where }),
    ]);
    return { items: items.map(mapAuthor), total };
  }

  // Route GET :slug được @Cacheable ở controller — request này xuất phát từ SERVER Next.js (Server
  // Component fetch qua publicFetch, ISR revalidate), không phải trình duyệt người xem thật, nên
  // KHÔNG tăng viewCount ở đây nữa (IP/identity ở đây luôn là IP của server Next.js, không thể chống
  // spam theo người xem thật). Việc tăng viewCount đã tách sang registerView() — gọi từ 1 request
  // riêng do trình duyệt bắn thẳng lên sau khi trang tải xong (xem PostViewTrackerService + endpoint
  // POST /posts/:id/view), lúc đó backend mới thấy đúng IP/user thật để chống F5 spam.
  async getBySlugPublic(slug: string) {
    const post = await this.prisma.post.findFirst({
      where: { slug, status: PostStatus.PUBLISHED },
      select: detailSelect,
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    return mapAuthor(post);
  }

  // Gọi từ POST /posts/:id/view — updateMany + lọc status để tự no-op an toàn nếu id sai/bài chưa
  // publish (không cần try/catch NotFound, endpoint này không cần báo lỗi cho client). Không
  // invalidatePrefix('posts') — giữ đúng tradeoff cache cũ, viewCount hiển thị trễ tối đa bằng TTL
  // cache của route GET :slug/GET list. Trả về title/slug (null nếu no-op) để controller ghi
  // UserActivity VIEW_POST mà không cần query riêng.
  async registerView(
    postId: string,
  ): Promise<{ title: string; slug: string } | null> {
    const result = await this.prisma.post.updateMany({
      where: { id: postId, status: PostStatus.PUBLISHED },
      data: { viewCount: { increment: 1 } },
    });
    if (result.count === 0) return null;
    return this.prisma.post.findUnique({
      where: { id: postId },
      select: { title: true, slug: true },
    });
  }

  async listAdmin(
    query: PageQuery & { status?: PostStatus; categorySlug?: string },
  ) {
    const { skip, take } = toPagination(query);
    const where: Prisma.PostWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.categorySlug && { category: { slug: query.categorySlug } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: listSelect,
      }),
      this.prisma.post.count({ where }),
    ]);
    return { items: items.map(mapAuthor), total };
  }

  async getByIdAdmin(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: detailSelect,
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    return mapAuthor(post);
  }

  async create(authorId: string, dto: CreatePostDto) {
    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);

    const status = await this.resolveStatus(authorId, dto.status);
    const slug = dto.slug
      ? dto.slug
      : await buildUniqueSlug(dto.title, (candidate) =>
          this.slugTaken(candidate),
        );

    const created = await this.prisma.post.create({
      data: {
        title: dto.title,
        slug,
        excerpt: dto.excerpt,
        contentHtml: dto.contentHtml,
        thumbnailUrl: dto.thumbnailUrl,
        categoryId: dto.categoryId,
        authorId,
        status,
        publishedAt: status === PostStatus.PUBLISHED ? new Date() : null,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        ogImageUrl: dto.ogImageUrl,
        canonicalUrl: dto.canonicalUrl,
      },
      select: detailSelect,
    });
    await this.cache.invalidatePrefix('posts');
    return mapAuthor(created);
  }

  async update(userId: string, id: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');

    const permissions = await this.roles.getUserPermissionKeys(userId);
    const isOwner = post.authorId === userId;
    const canEdit = isOwner
      ? permissions.includes(PERMISSIONS.POST_EDIT_OWN) ||
        permissions.includes(PERMISSIONS.POST_EDIT_ANY)
      : permissions.includes(PERMISSIONS.POST_EDIT_ANY);
    if (!canEdit) {
      throw new ForbiddenException('Bạn không có quyền sửa bài viết này');
    }
    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);

    const nextStatus =
      dto.status !== undefined
        ? await this.resolveStatus(userId, dto.status)
        : undefined;

    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.excerpt !== undefined && { excerpt: dto.excerpt }),
        ...(dto.contentHtml !== undefined && { contentHtml: dto.contentHtml }),
        ...(dto.thumbnailUrl !== undefined && {
          thumbnailUrl: dto.thumbnailUrl,
        }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
        ...(dto.metaDescription !== undefined && {
          metaDescription: dto.metaDescription,
        }),
        ...(dto.ogImageUrl !== undefined && { ogImageUrl: dto.ogImageUrl }),
        ...(dto.canonicalUrl !== undefined && {
          canonicalUrl: dto.canonicalUrl,
        }),
        ...(nextStatus !== undefined && {
          status: nextStatus,
          publishedAt:
            nextStatus === PostStatus.PUBLISHED ? new Date() : post.publishedAt,
        }),
      },
      select: detailSelect,
    });
    await this.cache.invalidatePrefix('posts');
    return mapAuthor(updated);
  }

  async remove(id: string): Promise<void> {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    await this.prisma.post.delete({ where: { id } });
    await this.cache.invalidatePrefix('posts');
  }

  // Chỉ user có quyền post.publish mới được đặt status PUBLISHED trực tiếp
  // (workflow duyệt bài đầy đủ — Nháp → Chờ duyệt → Xuất bản — là phạm vi Phase 2.1).
  private async resolveStatus(
    userId: string,
    requested?: PostStatus,
  ): Promise<PostStatus> {
    if (!requested || requested !== PostStatus.PUBLISHED) {
      return requested ?? PostStatus.DRAFT;
    }
    const permissions = await this.roles.getUserPermissionKeys(userId);
    if (!permissions.includes(PERMISSIONS.POST_PUBLISH)) {
      throw new ForbiddenException('Bạn không có quyền xuất bản bài viết');
    }
    return PostStatus.PUBLISHED;
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new BadRequestException('Danh mục không tồn tại');
  }

  private async slugTaken(slug: string): Promise<boolean> {
    const existing = await this.prisma.post.findUnique({ where: { slug } });
    return existing !== null;
  }
}
