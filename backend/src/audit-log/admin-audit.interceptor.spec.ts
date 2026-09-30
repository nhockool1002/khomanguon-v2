import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditAction } from '@prisma/client';
import { lastValueFrom, of } from 'rxjs';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import {
  AdminAuditInterceptor,
  sanitizeForAudit,
} from './admin-audit.interceptor';
import { SkipAudit } from './audit.decorators';
import type { AuditLogService } from './audit-log.service';

class SiteSettingsController {
  @Permissions(PERMISSIONS.SETTINGS_GENERAL)
  updateGeneral() {}

  @Permissions(PERMISSIONS.COMMENT_CREATE)
  memberAction() {}

  @SkipAudit()
  @Permissions(PERMISSIONS.WALLET_ADJUST)
  alreadyAudited() {}
}

function run(
  handler: keyof SiteSettingsController,
  request: Record<string, unknown>,
  result: unknown = { id: 'created-1' },
) {
  const log = jest.fn().mockResolvedValue(undefined);
  const interceptor = new AdminAuditInterceptor(new Reflector(), {
    log,
  } as unknown as AuditLogService);
  const ctx = {
    getType: () => 'http',
    // eslint-disable-next-line @typescript-eslint/unbound-method -- chỉ đọc metadata, không gọi hàm
    getHandler: () => SiteSettingsController.prototype[handler],
    getClass: () => SiteSettingsController,
    switchToHttp: () => ({
      getRequest: () => ({
        params: {},
        query: {},
        body: {},
        ip: '1.2.3.4',
        ...request,
      }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: () => of(result) };
  return lastValueFrom(interceptor.intercept(ctx, next)).then(() => log);
}

describe('AdminAuditInterceptor', () => {
  it('ghi ADMIN_ACTION cho thao tác quản trị thành công, kèm nhãn + body đã che bí mật', async () => {
    const log = await run('updateGeneral', {
      method: 'PUT',
      user: { id: 'admin-1' },
      route: { path: '/settings/general' },
      body: {
        siteTitle: 'KMN',
        apiKey: 'sk_live_123',
        nested: { password: 'x' },
      },
    });
    expect(log).toHaveBeenCalledWith('admin-1', AuditAction.ADMIN_ACTION, {
      targetType: 'settings',
      targetId: 'created-1',
      ipAddress: '1.2.3.4',
      metadata: expect.objectContaining({
        label: 'Lưu cài đặt chung',
        method: 'PUT',
        route: '/settings/general',
        body: {
          siteTitle: 'KMN',
          apiKey: '[ẩn]',
          nested: { password: '[ẩn]' },
        },
      }) as unknown,
    });
  });

  it('lấy targetId từ :id trên đường dẫn', async () => {
    const log = await run('updateGeneral', {
      method: 'DELETE',
      user: { id: 'admin-1' },
      route: { path: '/posts/:id' },
      params: { id: 'post-9' },
    });
    const [[, , options]] = log.mock.calls as [[string, string, object]];
    expect(options).toMatchObject({
      targetType: 'posts',
      targetId: 'post-9',
    });
  });

  it('không ghi GET, không ghi khi chưa đăng nhập', async () => {
    expect(
      await run('updateGeneral', { method: 'GET', user: { id: 'a' } }),
    ).not.toHaveBeenCalled();
    expect(
      await run('updateGeneral', { method: 'PUT' }),
    ).not.toHaveBeenCalled();
  });

  it('không ghi route chỉ cần quyền thành viên (bình luận, ví của mình...)', async () => {
    const log = await run('memberAction', {
      method: 'POST',
      user: { id: 'u' },
    });
    expect(log).not.toHaveBeenCalled();
  });

  it('không ghi route đã tự audit chi tiết (@SkipAudit)', async () => {
    const log = await run('alreadyAudited', {
      method: 'POST',
      user: { id: 'a' },
    });
    expect(log).not.toHaveBeenCalled();
  });
});

describe('sanitizeForAudit', () => {
  it('cắt chuỗi dài (vd nội dung HTML bài viết)', () => {
    const out = sanitizeForAudit({ contentHtml: 'a'.repeat(1000) }) as {
      contentHtml: string;
    };
    expect(out.contentHtml.length).toBeLessThan(400);
    expect(out.contentHtml).toContain('+700 ký tự');
  });

  it('che mọi khoá bí mật, giữ nguyên khoá thường', () => {
    expect(
      sanitizeForAudit({
        webhookApiKey: 'k',
        apiAccessToken: 't',
        secretAccessKey: 's',
        accessKeyId: 'AKIA',
        label: 'R2',
        objectKey: 'a.zip',
      }),
    ).toEqual({
      webhookApiKey: '[ẩn]',
      apiAccessToken: '[ẩn]',
      secretAccessKey: '[ẩn]',
      accessKeyId: '[ẩn]',
      label: 'R2',
      objectKey: 'a.zip',
    });
  });
});
