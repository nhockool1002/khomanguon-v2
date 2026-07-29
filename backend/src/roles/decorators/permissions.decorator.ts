import { SetMetadata } from '@nestjs/common';
import { PermissionKey } from '../permissions.constant';

export const PERMISSIONS_KEY = 'permissions';

// Áp cùng @UseGuards(JwtAuthGuard, PermissionsGuard) — PermissionsGuard cần req.user do JwtAuthGuard gắn trước.
export const Permissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
