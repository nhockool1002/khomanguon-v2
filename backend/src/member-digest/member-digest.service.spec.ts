import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  MemberDigestBatchStatus,
  MemberDigestRecipientStatus,
  MemberDigestTrigger,
} from '@prisma/client';
import { MemberDigestService } from './member-digest.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

describe('MemberDigestService — chọn nội dung không trùng, hàng đợi gửi theo lô', () => {
  let service: MemberDigestService;
  let prisma: {
    siteSetting: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
    post: Record<string, jest.Mock>;
    downloadEvent: Record<string, jest.Mock>;
    downloadLink: Record<string, jest.Mock>;
    memberDigestBatch: Record<string, jest.Mock>;
    memberDigestRecipient: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let mail: { send: jest.Mock };

  beforeEach(async () => {
    prisma = {
      siteSetting: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      post: { findMany: jest.fn().mockResolvedValue([]) },
      downloadEvent: { groupBy: jest.fn().mockResolvedValue([]) },
      downloadLink: { findMany: jest.fn().mockResolvedValue([]) },
      memberDigestBatch: {
        create: jest.fn().mockResolvedValue({ id: 'batch-new' }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      memberDigestRecipient: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      // Hỗ trợ cả 2 kiểu $transaction dùng trong service: callback (createBatchIfDue, tx = chính
      // object prisma mock này) và mảng promise (listBatches/getBatchRecipients).
      $transaction: jest.fn(
        async (
          arg: ((tx: unknown) => Promise<unknown>) | Promise<unknown>[],
        ) => {
          if (typeof arg === 'function') {
            return arg(prisma);
          }
          return Promise.all(arg);
        },
      ),
    };
    mail = { send: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemberDigestService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('https://test.local') },
        },
      ],
    }).compile();

    service = module.get(MemberDigestService);
  });

  describe('createBatchIfDue()', () => {
    const post = (id: string) => ({
      id,
      title: `Post ${id}`,
      slug: id,
      excerpt: null,
    });

    it('loại bài trùng giữa 3 nhóm — bài đã ở newPosts không lặp lại ở mostDownloaded', async () => {
      prisma.post.findMany
        .mockResolvedValueOnce([post('p1')]) // newPosts
        .mockResolvedValueOnce([post('p2')]) // mostViewed
        .mockResolvedValueOnce([post('p3')]); // computeMostDownloaded: post lookup theo topPostIds
      // p1 đã nằm trong newPosts -> phải bị loại khỏi nhóm downloaded dù có lượt tải.
      prisma.downloadEvent.groupBy.mockResolvedValue([
        { downloadLinkId: 'l1', _count: { _all: 10 } },
        { downloadLinkId: 'l2', _count: { _all: 5 } },
      ]);
      prisma.downloadLink.findMany.mockResolvedValue([
        { id: 'l1', postId: 'p1' },
        { id: 'l2', postId: 'p3' },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', email: 'u1@test.local' },
      ]);

      const result = await service.createBatchIfDue(MemberDigestTrigger.CRON);

      expect(result.batchId).toBe('batch-new');
      expect(result.totalRecipients).toBe(1);
      const [[createArg]] = prisma.memberDigestBatch.create.mock.calls as [
        [{ data: Record<string, unknown> }],
      ];
      expect(createArg.data).toMatchObject({
        newPostCount: 1,
        mostViewedCount: 1,
        mostDownloadedCount: 1, // chỉ p3 — p1 bị loại vì đã ở newPosts
      });
      const snapshot = createArg.data.contentSnapshot as {
        mostDownloaded: { id: string }[];
      };
      expect(snapshot.mostDownloaded.map((p) => p.id)).toEqual(['p3']);
      expect(prisma.memberDigestRecipient.createMany).toHaveBeenCalledWith({
        data: [{ batchId: 'batch-new', userId: 'u1', email: 'u1@test.local' }],
      });
    });

    it('không có bài nào ở cả 3 nhóm -> bỏ qua, không tạo batch', async () => {
      const result = await service.createBatchIfDue(MemberDigestTrigger.CRON);
      expect(result.batchId).toBeNull();
      expect(result.skippedReason).toBeDefined();
      expect(prisma.memberDigestBatch.create).not.toHaveBeenCalled();
    });

    it('có nội dung nhưng không ai đủ điều kiện nhận -> bỏ qua, không tạo batch', async () => {
      prisma.post.findMany.mockResolvedValueOnce([post('p1')]);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.createBatchIfDue(MemberDigestTrigger.CRON);
      expect(result.batchId).toBeNull();
      expect(result.skippedReason).toContain('thành viên');
      expect(prisma.memberDigestBatch.create).not.toHaveBeenCalled();
    });
  });

  describe('processNextChunk()', () => {
    const emptySnapshot = { newPosts: [], mostViewed: [], mostDownloaded: [] };

    it('gửi thành công -> SENT; gửi lỗi -> FAILED; hết recipient -> batch COMPLETED', async () => {
      prisma.memberDigestBatch.findFirst.mockResolvedValue({
        id: 'batch-1',
        status: MemberDigestBatchStatus.PENDING,
        contentSnapshot: emptySnapshot,
      });
      prisma.memberDigestRecipient.findMany.mockResolvedValue([
        {
          id: 'r1',
          email: 'ok@test.local',
          user: { displayName: 'Ok User' },
        },
        {
          id: 'r2',
          email: 'fail@test.local',
          user: { displayName: 'Fail User' },
        },
      ]);
      mail.send
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('SMTP down'));
      prisma.memberDigestRecipient.count.mockResolvedValue(0); // không còn PENDING -> COMPLETED

      const result = await service.processNextChunk();

      expect(result.processed).toBe(2);
      expect(prisma.memberDigestBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { status: MemberDigestBatchStatus.RUNNING },
      });
      expect(prisma.memberDigestRecipient.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: {
          status: MemberDigestRecipientStatus.SENT,
          sentAt: expect.any(Date) as Date,
        },
      });
      expect(prisma.memberDigestRecipient.update).toHaveBeenCalledWith({
        where: { id: 'r2' },
        data: {
          status: MemberDigestRecipientStatus.FAILED,
          errorMessage: 'SMTP down',
        },
      });
      expect(prisma.memberDigestBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: {
          status: MemberDigestBatchStatus.COMPLETED,
          finishedAt: expect.any(Date) as Date,
        },
      });
    });

    it('không có batch nào đang chờ -> không làm gì', async () => {
      prisma.memberDigestBatch.findFirst.mockResolvedValue(null);
      const result = await service.processNextChunk();
      expect(result.processed).toBe(0);
      expect(mail.send).not.toHaveBeenCalled();
    });
  });
});
