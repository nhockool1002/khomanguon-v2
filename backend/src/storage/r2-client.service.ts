import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from '../common/secret-crypto.util';

const DEFAULT_EXPIRES_SECONDS = 60 * 10; // 10 phút — đủ để bắt đầu tải, ngắn để hạn chế chia sẻ link (UC24/UC25)
const LIST_MAX_KEYS = 1000; // giới hạn 1 trang S3 ListObjectsV2 — chưa làm phân trang continuation-token

export interface CloudObjectSummary {
  key: string; // đã bỏ uploadPrefix — khớp đúng định dạng DownloadLink.objectKey
  sizeBytes: number;
  lastModified: Date | null;
}

// R2 tương thích API S3 (chỉ khác endpoint) nên dùng chung @aws-sdk/client-s3 cho cả 2
// StorageProviderType thay vì viết 2 client riêng — mục 4.3 Migration_Plan.md.
@Injectable()
export class R2ClientService {
  constructor(private readonly prisma: PrismaService) {}

  private async getProvider(providerId: string) {
    const provider = await this.prisma.storageProvider.findUnique({
      where: { id: providerId },
    });
    if (!provider)
      throw new NotFoundException('Không tìm thấy storage provider');
    return provider;
  }

  // R2 không có khái niệm "endpoint" riêng để nhập tay — chỉ cần Account ID (đúng như trang cài đặt
  // R2 của v1: chỉ hỏi Account ID, không hỏi endpoint), endpoint S3-compatible luôn có dạng cố định
  // "https://{accountId}.r2.cloudflarestorage.com". Cột `endpoint` vẫn lưu Account ID (chuỗi ngắn),
  // suy ra URL đầy đủ ở đây — không cần thêm cột DB mới. Nếu ai lỡ dán nguyên URL thì vẫn nhận diện được.
  private buildEndpoint(provider: {
    type: string;
    endpoint: string | null;
  }): string | undefined {
    if (!provider.endpoint) return undefined;
    if (provider.type !== 'R2' || provider.endpoint.startsWith('http'))
      return provider.endpoint;
    return `https://${provider.endpoint}.r2.cloudflarestorage.com`;
  }

  private buildClient(provider: {
    type: string;
    endpoint: string | null;
    region: string | null;
    accessKeyId: string;
    secretAccessKeyEncrypted: string;
  }): S3Client {
    return new S3Client({
      region: provider.region ?? 'auto',
      endpoint: this.buildEndpoint(provider),
      // R2 dùng path-style; S3 chuẩn thường virtual-hosted nhưng path-style vẫn hoạt động được.
      forcePathStyle: provider.type === 'R2',
      credentials: {
        accessKeyId: provider.accessKeyId,
        secretAccessKey: decryptSecret(provider.secretAccessKeyEncrypted),
      },
    });
  }

  // Object key logic ("con") <-> key thật trong bucket (có uploadPrefix) — DownloadLink.objectKey
  // luôn lưu dạng "con" để không phụ thuộc prefix cấu hình sau này đổi.
  private toPrefixedKey(
    provider: { uploadPrefix: string | null },
    key: string,
  ): string {
    return provider.uploadPrefix ? `${provider.uploadPrefix}/${key}` : key;
  }

  private fromPrefixedKey(
    provider: { uploadPrefix: string | null },
    prefixedKey: string,
  ): string {
    if (!provider.uploadPrefix) return prefixedKey;
    const withSlash = `${provider.uploadPrefix}/`;
    return prefixedKey.startsWith(withSlash)
      ? prefixedKey.slice(withSlash.length)
      : prefixedKey;
  }

  async putObject(
    providerId: string,
    key: string,
    body: Buffer,
    contentType?: string,
  ): Promise<void> {
    const provider = await this.getProvider(providerId);
    const client = this.buildClient(provider);
    await client.send(
      new PutObjectCommand({
        Bucket: provider.bucket,
        Key: this.toPrefixedKey(provider, key),
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  // "Tạo link từ cloud key" — sinh presigned URL tạm thời từ object key đã lưu trong DownloadLink,
  // không cần bucket public. Không log URL ra ngoài — chỉ trả cho người dùng đã được cấp quyền tải.
  async getPresignedDownloadUrl(
    providerId: string,
    objectKey: string,
    expiresInSeconds: number = DEFAULT_EXPIRES_SECONDS,
  ): Promise<string> {
    const provider = await this.getProvider(providerId);
    const client = this.buildClient(provider);
    const command = new GetObjectCommand({
      Bucket: provider.bucket,
      Key: this.toPrefixedKey(provider, objectKey),
    });
    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  }

  // Liệt kê file thật trong bucket — dùng cho trang Quản lý File Cloud (đối chiếu với DownloadLink
  // đã cấu hình). subPrefix (tuỳ chọn) lọc thêm 1 thư mục con bên trong uploadPrefix của provider.
  async listObjects(
    providerId: string,
    subPrefix?: string,
  ): Promise<CloudObjectSummary[]> {
    const provider = await this.getProvider(providerId);
    const client = this.buildClient(provider);
    const basePrefix = provider.uploadPrefix ? `${provider.uploadPrefix}/` : '';
    const prefix = subPrefix ? `${basePrefix}${subPrefix}` : basePrefix;

    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: provider.bucket,
        Prefix: prefix || undefined,
        MaxKeys: LIST_MAX_KEYS,
      }),
    );

    return (result.Contents ?? [])
      .filter((obj) => obj.Key && !obj.Key.endsWith('/')) // bỏ "thư mục ảo" (key kết thúc bằng /)
      .map((obj) => ({
        key: this.fromPrefixedKey(provider, obj.Key!),
        sizeBytes: obj.Size ?? 0,
        lastModified: obj.LastModified ?? null,
      }));
  }

  async deleteObject(providerId: string, key: string): Promise<void> {
    const provider = await this.getProvider(providerId);
    const client = this.buildClient(provider);
    await client.send(
      new DeleteObjectCommand({
        Bucket: provider.bucket,
        Key: this.toPrefixedKey(provider, key),
      }),
    );
  }
}
