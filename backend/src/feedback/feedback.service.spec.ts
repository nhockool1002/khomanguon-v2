import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FeedbackStatus } from '@prisma/client';
import { FeedbackService } from './feedback.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

describe('FeedbackService — email bắt buộc, chống trùng, phản hồi qua email', () => {
  let service: FeedbackService;
  let prisma: {
    user: Record<string, jest.Mock>;
    feedback: Record<string, jest.Mock>;
  };
  let mail: {
    sendFeedbackAdminNotification: jest.Mock;
    sendFeedbackReply: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ displayName: 'Kang', email: 'kang@test.local' }),
      },
      feedback: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'fb-new' }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'fb-1' }),
      },
    };
    mail = {
      sendFeedbackAdminNotification: jest.fn(),
      sendFeedbackReply: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get(FeedbackService);
  });

  describe('create()', () => {
    it('khách ẩn danh không nhập email -> BadRequest, không tạo bản ghi', async () => {
      await expect(
        service.create(null, { message: 'Hi team' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.feedback.create).not.toHaveBeenCalled();
    });

    it('khách ẩn danh có email -> lưu email', async () => {
      await service.create(null, {
        message: 'Hi team',
        email: 'theara@test.local',
      });
      expect(prisma.feedback.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'theara@test.local',
          message: 'Hi team',
        }) as unknown,
      });
    });

    it('đã đăng nhập -> không cần email trong dto (lấy từ tài khoản)', async () => {
      await service.create('user-1', { message: 'Hi team' });
      expect(prisma.feedback.create).toHaveBeenCalled();
      expect(mail.sendFeedbackAdminNotification).toHaveBeenCalledWith(
        expect.objectContaining({ contactEmail: 'kang@test.local' }),
      );
    });

    it('gửi lại cùng nội dung trong 10 phút -> trả bản cũ, không tạo bản trùng', async () => {
      prisma.feedback.findFirst.mockResolvedValue({ id: 'fb-old' });
      const result = await service.create(null, {
        message: 'Hi team',
        email: 'theara@test.local',
      });
      expect(result).toEqual({ id: 'fb-old' });
      expect(prisma.feedback.create).not.toHaveBeenCalled();
    });
  });

  describe('reply()', () => {
    const anonymous = {
      name: 'Theara',
      email: 'theara@test.local',
      message: 'Cannot pay with QR',
      author: null,
    };

    it('gửi email tới người góp ý rồi đánh dấu RESOLVED + lưu nội dung phản hồi', async () => {
      prisma.feedback.findUnique.mockResolvedValue(anonymous);
      await service.reply('fb-1', 'admin-1', '  Please contact us  ');
      expect(mail.sendFeedbackReply).toHaveBeenCalledWith(
        {
          displayName: 'Theara',
          originalMessage: 'Cannot pay with QR',
          replyMessage: 'Please contact us',
        },
        'theara@test.local',
      );
      const [[{ data }]] = prisma.feedback.update.mock.calls as [
        [{ data: Record<string, unknown> }],
      ];
      expect(data).toMatchObject({
        status: FeedbackStatus.RESOLVED,
        resolvedById: 'admin-1',
        replyMessage: 'Please contact us',
      });
    });

    it('ưu tiên email tài khoản khi góp ý gửi lúc đã đăng nhập', async () => {
      prisma.feedback.findUnique.mockResolvedValue({
        ...anonymous,
        email: null,
        author: { displayName: 'Kang', email: 'kang@test.local' },
      });
      await service.reply('fb-1', 'admin-1', 'Thanks');
      expect(mail.sendFeedbackReply).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Kang' }),
        'kang@test.local',
      );
    });

    it('góp ý không có email -> BadRequest, không gửi mail, không cập nhật', async () => {
      prisma.feedback.findUnique.mockResolvedValue({
        ...anonymous,
        email: null,
      });
      await expect(
        service.reply('fb-1', 'admin-1', 'Thanks'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mail.sendFeedbackReply).not.toHaveBeenCalled();
      expect(prisma.feedback.update).not.toHaveBeenCalled();
    });

    it('gửi mail lỗi -> BadRequest, KHÔNG đánh dấu đã xử lý', async () => {
      prisma.feedback.findUnique.mockResolvedValue(anonymous);
      mail.sendFeedbackReply.mockRejectedValue(new Error('SMTP down'));
      await expect(
        service.reply('fb-1', 'admin-1', 'Thanks'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.feedback.update).not.toHaveBeenCalled();
    });
  });
});
