import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS, type PermissionKey } from '../roles/permissions.constant';
import { AUDIT_ROUTE_LABELS } from './audit-labels';
import { FORCE_AUDIT_KEY, SKIP_AUDIT_KEY } from './audit.decorators';

const MEMBER_PERMISSIONS = new Set<PermissionKey>([
  PERMISSIONS.COMMENT_CREATE,
  PERMISSIONS.WALLET_VIEW_OWN,
  PERMISSIONS.DOWNLOAD_PURCHASE,
]);
const MUTATING = new Set<RequestMethod>([
  RequestMethod.POST,
  RequestMethod.PUT,
  RequestMethod.PATCH,
  RequestMethod.DELETE,
]);

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return controllerFiles(full);
    return name.endsWith('.controller.ts') ? [full] : [];
  });
}

// Liệt kê mọi route quản trị (thay đổi dữ liệu, cần quyền quản trị hoặc @AuditAdminAction, không
// @SkipAudit) — đúng tập route AdminAuditInterceptor sẽ ghi log.
function auditedRoutes(): string[] {
  const keys: string[] = [];
  for (const file of controllerFiles(join(__dirname, '..'))) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(file) as Record<string, unknown>;
    for (const exported of Object.values(mod)) {
      if (
        typeof exported !== 'function' ||
        !exported.name.endsWith('Controller')
      )
        continue;
      const proto = (exported as { prototype: Record<string, unknown> })
        .prototype;
      for (const name of Object.getOwnPropertyNames(proto)) {
        const handler = proto[name];
        if (typeof handler !== 'function' || name === 'constructor') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as
          RequestMethod | undefined;
        if (method === undefined || !MUTATING.has(method)) continue;
        if (Reflect.getMetadata(SKIP_AUDIT_KEY, handler)) continue;
        const perms = (Reflect.getMetadata(PERMISSIONS_KEY, handler) ??
          []) as PermissionKey[];
        const forced = Reflect.getMetadata(FORCE_AUDIT_KEY, handler) === true;
        if (forced || perms.some((p) => !MEMBER_PERMISSIONS.has(p))) {
          keys.push(`${exported.name}.${name}`);
        }
      }
    }
  }
  return keys;
}

describe('AUDIT_ROUTE_LABELS — mọi thao tác quản trị đều có nhãn tiếng Việt', () => {
  const routes = auditedRoutes();

  it('quét được route quản trị (sanity check)', () => {
    expect(routes).toEqual(
      expect.arrayContaining([
        'PostsController.update',
        'SiteSettingsController.updateGeneral',
      ]),
    );
  });

  it('route quản trị nào cũng có nhãn (thêm route mới -> thêm nhãn vào audit-labels.ts)', () => {
    expect(routes.filter((key) => !AUDIT_ROUTE_LABELS[key])).toEqual([]);
  });

  it('không còn nhãn thừa trỏ tới route đã xoá/đổi tên', () => {
    expect(
      Object.keys(AUDIT_ROUTE_LABELS).filter((key) => !routes.includes(key)),
    ).toEqual([]);
  });
});
