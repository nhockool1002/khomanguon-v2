import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditAction } from '@prisma/client';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PERMISSIONS_KEY } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS, type PermissionKey } from '../roles/permissions.constant';
import { AuditLogService } from './audit-log.service';
import { AUDIT_ROUTE_LABELS } from './audit-labels';
import { FORCE_AUDIT_KEY, SKIP_AUDIT_KEY } from './audit.decorators';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Quyền "tự phục vụ" của thành viên thường — route CHỈ yêu cầu các quyền này (bình luận, nạp/xem ví
// của mình, mua link tải) không phải thao tác quản trị nên không ghi audit.
const MEMBER_PERMISSIONS = new Set<PermissionKey>([
  PERMISSIONS.COMMENT_CREATE,
  PERMISSIONS.WALLET_VIEW_OWN,
  PERMISSIONS.DOWNLOAD_PURCHASE,
]);

// Khoá chứa bí mật — luôn che trước khi lưu vào metadata audit (audit log xem được trên UI).
const SECRET_KEY_PATTERN =
  /pass(word)?|secret|token|api_?key|access_?key|private_?key|credential/i;
const MAX_STRING = 300;
const MAX_ARRAY = 30;
const MAX_DEPTH = 4;

export function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}… (+${value.length - MAX_STRING} ký tự)`
      : value;
  }
  if (typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[…]';
  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY)
      .map((v) => sanitizeForAudit(v, depth + 1));
    return value.length > MAX_ARRAY
      ? [...items, `… (+${value.length - MAX_ARRAY} mục)`]
      : items;
  }
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] =
      SECRET_KEY_PATTERN.test(key) && v !== '' && v !== null && v !== undefined
        ? '[ẩn]'
        : sanitizeForAudit(v, depth + 1);
  }
  return out;
}

interface AuditRequest extends Request {
  user?: { id: string };
}

// Ghi audit TỰ ĐỘNG cho mọi thao tác quản trị: request thay đổi dữ liệu (POST/PUT/PATCH/DELETE) thành
// công, có user đăng nhập, trên route yêu cầu ít nhất 1 quyền quản trị (@Permissions ngoài nhóm
// MEMBER_PERMISSIONS) hoặc đánh dấu @AuditAdminAction(). Route mới thêm sau này tự được ghi, không
// phải nhớ gọi AuditLogService.log() từng chỗ. Route đã ghi audit chi tiết riêng dùng @SkipAudit().
// Chỉ ghi khi thành công (tap next) — request lỗi (403/400...) không làm thay đổi dữ liệu.
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLog: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<AuditRequest>();
    if (!MUTATING_METHODS.has(request.method) || !request.user?.id) {
      return next.handle();
    }

    const handler = context.getHandler();
    const controller = context.getClass();
    if (
      this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT_KEY, [
        handler,
        controller,
      ])
    ) {
      return next.handle();
    }
    const forced = this.reflector.getAllAndOverride<boolean>(FORCE_AUDIT_KEY, [
      handler,
      controller,
    ]);
    const required =
      this.reflector.get<PermissionKey[] | undefined>(
        PERMISSIONS_KEY,
        handler,
      ) ?? [];
    const isAdminRoute = required.some((p) => !MEMBER_PERMISSIONS.has(p));
    if (!forced && !isAdminRoute) return next.handle();

    const actorUserId = request.user.id;
    const routeKey = `${controller.name}.${handler.name}`;
    const routePath =
      (request.route as { path?: string } | undefined)?.path ?? request.path;

    return next.handle().pipe(
      tap((result: unknown) => {
        const response = context.switchToHttp().getResponse<Response>();
        const params: Record<string, string | string[]> = request.params ?? {};
        const resultId =
          result && typeof result === 'object' && 'id' in result
            ? String(result.id)
            : undefined;
        const rawTargetId =
          params.id ??
          params.linkId ??
          params.userId ??
          params.postId ??
          Object.values(params)[0];
        const targetId = rawTargetId
          ? [rawTargetId].flat().join('/')
          : resultId;
        // Multer gắn req.file khi route upload (FileInterceptor) — chỉ đọc vài trường để ghi log.
        const file = (
          request as {
            file?: { originalname: string; size: number; mimetype: string };
          }
        ).file;
        const body: unknown = request.body;
        const hasBody =
          body && typeof body === 'object' && Object.keys(body).length > 0;
        const query = request.query as Record<string, unknown> | undefined;
        const statusCode: number = response.statusCode;
        const metadata: Record<string, unknown> = {
          label:
            AUDIT_ROUTE_LABELS[routeKey] ?? `${request.method} ${routePath}`,
          method: request.method,
          route: routePath,
          handler: routeKey,
          statusCode,
        };
        if (Object.keys(params).length > 0) metadata.params = params;
        if (query && Object.keys(query).length > 0) {
          metadata.query = sanitizeForAudit(query);
        }
        if (hasBody) metadata.body = sanitizeForAudit(body);
        if (file) {
          metadata.file = {
            name: file.originalname,
            size: file.size,
            type: file.mimetype,
          };
        }
        void this.auditLog.log(actorUserId, AuditAction.ADMIN_ACTION, {
          targetType: routePath.split('/').filter(Boolean)[0] ?? undefined,
          targetId,
          ipAddress: (request as { ip?: string }).ip,
          metadata,
        });
      }),
    );
  }
}
