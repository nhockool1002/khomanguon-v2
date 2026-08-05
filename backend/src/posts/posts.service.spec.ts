import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PostStatus } from '@prisma/client';
import { PostsService } from './posts.service';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CacheService } from '../cache/cache.service';

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
});
