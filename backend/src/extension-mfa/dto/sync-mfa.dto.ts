import { IsObject } from 'class-validator';

// `data` là bì ciphertext AES-GCM ({iv, data} base64) K-Extension tự mã hoá phía client bằng key
// suy ra từ mật khẩu tài khoản — backend không giữ key, không giải mã được, chỉ lưu/trả nguyên
// khối (xem comment model ExtensionMfaData trong schema.prisma).
export class SyncMfaDto {
  @IsObject()
  data: Record<string, unknown>;
}
