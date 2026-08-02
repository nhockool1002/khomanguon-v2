import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

// Mã hoá đối xứng AES-256-GCM cho secret cần đọc lại được (StorageProvider.secretAccessKeyEncrypted,
// SePay webhook API key...) — khác token.util.ts (chỉ hash một chiều). Key nguồn từ STORAGE_SECRET_KEY
// (env), scrypt ra đúng 32 byte cho AES-256 dù env là chuỗi tuỳ ý. Output:
// base64(iv).base64(authTag).base64(ciphertext) để tự chứa, không cần lưu iv/tag ở cột riêng.
//
// `context` tách domain mã hoá giữa các loại secret khác nhau (không bắt buộc về mặt an toàn AES-GCM
// vì IV luôn ngẫu nhiên, nhưng tránh nhầm lẫn/tái dùng salt) — mặc định giữ nguyên salt cũ
// ("khomanguon-storage-provider") để không phá dữ liệu StorageProvider đã mã hoá từ trước.
const DEFAULT_CONTEXT = 'khomanguon-storage-provider';

function deriveKey(context: string): Buffer {
  const secret = process.env.STORAGE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      'Thiếu biến môi trường STORAGE_SECRET_KEY để mã hoá secret',
    );
  }
  return scryptSync(secret, context, 32);
}

export function encryptSecret(
  plaintext: string,
  context: string = DEFAULT_CONTEXT,
): string {
  const key = deriveKey(context);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

export function decryptSecret(
  encrypted: string,
  context: string = DEFAULT_CONTEXT,
): string {
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split('.');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Định dạng secret đã mã hoá không hợp lệ');
  }
  const key = deriveKey(context);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
