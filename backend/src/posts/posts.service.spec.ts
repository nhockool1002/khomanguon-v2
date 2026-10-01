import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PostStatus } from '@prisma/client';
import { PostsService } from './posts.service';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CacheService } from '../cache/cache.service';
import { FrontendRevalidateService } from '../cache/frontend-revalidate.service';
import { BadgesService } from '../badges/badges.service';

describe('PostsService.update — phân quyền sửa bài (post.edit.own / post.edit.any)', () => {
  let service: PostsService;
  let prisma: {
    post: Record<string, jest.Mock>;
    category: Record<string, jest.Mock>;
  };
  let roles: { getUserPermissionKeys: jest.Mock };

  const basePost = {
    id: 'post-1',
    authorId: 'author-1',
    publishedAt: null as Date | null,
    tags: [] as { tag: { id: string; name: string; slug: string } }[],
    author: {
      id: 'author-1',
      displayName: 'Author',
      avatarUrl: null as string | null,
      primaryRoleId: null as string | null,
      roles: [] as { roleId: string; role: { slug: string } }[],
    },
  };

  beforeEach(async () => {
    prisma = {
      post: {
        findUnique: jest.fn().mockResolvedValue(basePost),
        update: jest
          .fn()
          .mockImplementation(
            ({ data }: { data: Record<string, unknown> }) => ({
              ...basePost,
              ...data,
            }),
          ),
      },
      category: { findUnique: jest.fn() },
    };
    roles = { getUserPermissionKeys: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RolesService, useValue: roles },
        {
          provide: CacheService,
          useValue: { invalidatePrefix: jest.fn() },
        },
        {
          provide: FrontendRevalidateService,
          useValue: { revalidateAll: jest.fn() },
        },
        {
          provide: BadgesService,
          useValue: { checkAndAward: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(PostsService);
  });

  it('chủ bài viết không có quyền post.edit.own vẫn bị chặn sửa bài của chính mình', async () => {
    roles.getUserPermissionKeys.mockResolvedValue([]);
    await expect(
      service.update('author-1', 'post-1', { title: 'Sửa' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('chủ bài viết có post.edit.own sửa được bài của chính mình', async () => {
    roles.getUserPermissionKeys.mockResolvedValue([PERMISSIONS.POST_EDIT_OWN]);
    await expect(
      service.update('author-1', 'post-1', { title: 'Sửa' }),
    ).resolves.toBeDefined();
  });

  it('người khác không có post.edit.any bị chặn sửa bài không phải của mình', async () => {
    roles.getUserPermissionKeys.mockResolvedValue([PERMISSIONS.POST_EDIT_OWN]);
    await expect(
      service.update('another-user', 'post-1', { title: 'Sửa' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('người khác có post.edit.any sửa được bài không phải của mình', async () => {
    roles.getUserPermissionKeys.mockResolvedValue([PERMISSIONS.POST_EDIT_ANY]);
    await expect(
      service.update('another-user', 'post-1', { title: 'Sửa' }),
    ).resolves.toBeDefined();
  });

  it('không có post.publish thì không thể tự đặt trạng thái PUBLISHED', async () => {
    roles.getUserPermissionKeys.mockResolvedValue([PERMISSIONS.POST_EDIT_OWN]);
    await expect(
      service.update('author-1', 'post-1', { status: PostStatus.PUBLISHED }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('có post.publish thì đặt trạng thái PUBLISHED thành công', async () => {
    roles.getUserPermissionKeys.mockResolvedValue([
      PERMISSIONS.POST_EDIT_OWN,
      PERMISSIONS.POST_PUBLISH,
    ]);
    const result = await service.update('author-1', 'post-1', {
      status: PostStatus.PUBLISHED,
    });
    expect(result.status).toBe(PostStatus.PUBLISHED);
  });

  it('publish lần đầu (publishedAt null) thì gán publishedAt mới', async () => {
    roles.getUserPermissionKeys.mockResolvedValue([
      PERMISSIONS.POST_EDIT_OWN,
      PERMISSIONS.POST_PUBLISH,
    ]);
    await service.update('author-1', 'post-1', {
      status: PostStatus.PUBLISHED,
    });
    const [[{ data }]] = prisma.post.update.mock.calls as [
      [{ data: { publishedAt: Date | null } }],
    ];
    expect(data.publishedAt).toBeInstanceOf(Date);
  });

  it('sửa bài đã publish thì giữ nguyên publishedAt cũ (issue #65)', async () => {
    const originalPublishedAt = new Date('2025-01-01T00:00:00Z');
    prisma.post.findUnique.mockResolvedValue({
      ...basePost,
      status: PostStatus.PUBLISHED,
      publishedAt: originalPublishedAt,
    });
    roles.getUserPermissionKeys.mockResolvedValue([
      PERMISSIONS.POST_EDIT_OWN,
      PERMISSIONS.POST_PUBLISH,
    ]);
    await service.update('author-1', 'post-1', {
      title: 'Sửa',
      status: PostStatus.PUBLISHED,
    });
    const [[{ data }]] = prisma.post.update.mock.calls as [
      [{ data: { publishedAt: Date | null } }],
    ];
    expect(data.publishedAt).toBe(originalPublishedAt);
  });

  describe('setVisibility() — công tắc Ẩn/Hiện', () => {
    it('ẩn: chỉ đổi PUBLISHED -> HIDDEN, không đụng publishedAt', async () => {
      prisma.post.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const result = await service.setVisibility('post-1', true);
      expect(prisma.post.updateMany).toHaveBeenCalledWith({
        where: { id: 'post-1', status: PostStatus.PUBLISHED },
        data: { status: PostStatus.HIDDEN },
      });
      expect(result).toEqual({ id: 'post-1', status: PostStatus.HIDDEN });
    });

    it('hiện lại: HIDDEN -> PUBLISHED', async () => {
      prisma.post.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      await service.setVisibility('post-1', false);
      expect(prisma.post.updateMany).toHaveBeenCalledWith({
        where: { id: 'post-1', status: PostStatus.HIDDEN },
        data: { status: PostStatus.PUBLISHED },
      });
    });

    it('bài Nháp/Chờ duyệt -> BadRequest', async () => {
      prisma.post.updateMany = jest.fn().mockResolvedValue({ count: 0 });
      prisma.post.findUnique.mockResolvedValue({ status: PostStatus.DRAFT });
      await expect(
        service.setVisibility('post-1', true),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('không có post.publish thì không tự đặt được HIDDEN qua form sửa bài', async () => {
      roles.getUserPermissionKeys.mockResolvedValue([
        PERMISSIONS.POST_EDIT_OWN,
      ]);
      await expect(
        service.update('author-1', 'post-1', { status: PostStatus.HIDDEN }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('bulkUpdate() — Bulk Actions', () => {
    it('Ẩn hàng loạt: chỉ bài PUBLISHED, trả số đã cập nhật / bỏ qua', async () => {
      prisma.post.updateMany = jest.fn().mockResolvedValue({ count: 2 });
      const result = await service.bulkUpdate(['a', 'b', 'c', 'a'], 'hide');
      expect(prisma.post.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['a', 'b', 'c'] }, status: PostStatus.PUBLISHED },
        data: { status: PostStatus.HIDDEN },
      });
      expect(result).toEqual({ updated: 2, skipped: 1 });
    });

    it('Hiện hàng loạt: HIDDEN -> PUBLISHED', async () => {
      prisma.post.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma.post.findMany = jest.fn().mockResolvedValue([]);
      await service.bulkUpdate(['a'], 'show');
      expect(prisma.post.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['a'] }, status: PostStatus.HIDDEN },
        data: { status: PostStatus.PUBLISHED },
      });
    });

    it('Đổi sang Xuất bản: chỉ gán publishedAt cho bài chưa từng xuất bản', async () => {
      const tx = {
        post: {
          updateMany: jest
            .fn()
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 2 }),
        },
      };
      (prisma as unknown as Record<string, unknown>).$transaction = jest.fn(
        (fn: (t: unknown) => unknown) => fn(tx),
      );
      prisma.post.findMany = jest
        .fn()
        .mockResolvedValue([{ authorId: 'author-1' }]);
      const result = await service.bulkUpdate(
        ['a', 'b', 'c'],
        'set-status',
        PostStatus.PUBLISHED,
      );
      const calls = tx.post.updateMany.mock.calls as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ][];
      expect(calls[0][0].where).toMatchObject({ publishedAt: null });
      expect(calls[0][0].data.publishedAt).toBeInstanceOf(Date);
      expect(calls[1][0].data).toEqual({ status: PostStatus.PUBLISHED });
      expect(result).toEqual({ updated: 3, skipped: 0 });
    });

    it('Đổi sang Nháp: không đụng publishedAt', async () => {
      const tx = {
        post: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      };
      (prisma as unknown as Record<string, unknown>).$transaction = jest.fn(
        (fn: (t: unknown) => unknown) => fn(tx),
      );
      await service.bulkUpdate(['a', 'b'], 'set-status', PostStatus.DRAFT);
      expect(tx.post.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['a', 'b'] }, status: { not: PostStatus.DRAFT } },
        data: { status: PostStatus.DRAFT },
      });
    });

    it('set-status thiếu trạng thái -> BadRequest', async () => {
      await expect(
        service.bulkUpdate(['a'], 'set-status'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
