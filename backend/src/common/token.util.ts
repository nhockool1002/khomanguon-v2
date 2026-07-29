import { createHash, randomBytes } from 'node:crypto';

// Token gốc chỉ tồn tại trong email/response một lần — DB chỉ lưu bản hash,
// giống cách lưu password nhưng không cần salt vì token đã đủ ngẫu nhiên (256 bit).
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
