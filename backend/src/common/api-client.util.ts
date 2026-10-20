import { ApiClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { hashToken } from './token.util';

export const API_CLIENT_KEY_HEADER = 'x-extension-key';

// Dùng chung bởi ApiClientGuard (extension-sync, bắt buộc có key hợp lệ) và AuthController (tuỳ
// chọn — login()/refresh() chỉ đổi hành vi trả refreshToken khi key hợp lệ, không bắt buộc với
// web frontend). Trả null thay vì throw vì 2 nơi gọi có cách xử lý "không hợp lệ" khác nhau.
export async function findActiveApiClient(
  prisma: PrismaService,
  rawKey: string | string[] | undefined,
): Promise<ApiClient | null> {
  if (!rawKey || typeof rawKey !== 'string') return null;
  const client = await prisma.apiClient.findUnique({
    where: { keyHash: hashToken(rawKey) },
  });
  return client && client.isActive ? client : null;
}
