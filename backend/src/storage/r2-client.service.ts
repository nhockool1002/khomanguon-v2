import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from '../common/secret-crypto.util';

const DEFAULT_EXPIRES_SECONDS = 60 * 10; // 10 phút — đủ để bắt đầu tải, ngắn để hạn chế chia sẻ link (UC24/UC25)
// Upload dài hơn download vì admin có thể xếp hàng nhiều file lớn rồi mới bắt đầu PUT lần lượt —
// chỉ cần trình duyệt BẮT ĐẦU gửi request trước khi hết hạn (S3/R2 chỉ kiểm chữ ký lúc nhận header
// đầu, không phải lúc nhận xong toàn bộ body), 30 phút là dư sức kể cả hàng chờ dài.
const UPLOAD_EXPIRES_SECONDS = 60 * 30;
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
  // MAILJET không có bucket (nullable trong schema) — file này chỉ xử lý R2/S3, nếu lỡ gọi nhầm với
  // provider thiếu bucket thì đó là lỗi dữ liệu cần biết ngay, không nên âm thầm bỏ qua.
  private requireBucket(provider: { bucket: string | null }): string {
    if (!provider.bucket) throw new Error('Storage provider thiếu bucket');
    return provider.bucket;
  }

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
        Bucket: this.requireBucket(provider),
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
      Bucket: this.requireBucket(provider),
      Key: this.toPrefixedKey(provider, objectKey),
    });
    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  }

  // Trang "Upload File Cloud" (/quan-tri/tep-cloud/upload) — trình duyệt PUT thẳng lên R2/S3 bằng
  // URL này, KHÔNG qua backend, để không giữ 1 request NestJS mở suốt lúc tải file nặng lên (tránh
  // timeout/nghẽn thread). Cố tình KHÔNG đưa ContentType vào command để ký — nếu ký kèm, request PUT
  // thật từ trình duyệt bắt buộc phải gửi đúng y hệt header Content-Type đã ký (SigV4), sai lệch dù
  // 1 ký tự (vd charset trình duyệt tự thêm) sẽ bị R2/S3 từ chối bằng SignatureDoesNotMatch. Không
  // ký thì Content-Type client gửi trong PUT thật vẫn được lưu lại bình thường (chỉ là không nằm
  // trong phần được xác thực chữ ký) — đơn giản và đủ dùng cho mục đích chỉ tải file lên.
  async getPresignedUploadUrl(
    providerId: string,
    key: string,
    expiresInSeconds: number = UPLOAD_EXPIRES_SECONDS,
  ): Promise<string> {
    const provider = await this.getProvider(providerId);
    const client = this.buildClient(provider);
    const command = new PutObjectCommand({
      Bucket: this.requireBucket(provider),
      Key: this.toPrefixedKey(provider, key),
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
        Bucket: this.requireBucket(provider),
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

  // Lấy dung lượng thật của đúng 1 object (HEAD, không cần liệt kê cả bucket như listObjects) —
  // dùng để tự bổ sung DownloadLink.sizeBytes cho các link đã tạo từ trước khi form Admin có ô
  // "Dò dung lượng" (xem download-links.service.ts getPublicInfo). Trả null nếu object không tồn
  // tại/không đọc được — không throw để không chặn hiển thị khối tải khi chỉ thiếu mỗi dung lượng.
  async headObjectSize(
    providerId: string,
    key: string,
  ): Promise<number | null> {
    const provider = await this.getProvider(providerId);
    const client = this.buildClient(provider);
    try {
      const result = await client.send(
        new HeadObjectCommand({
          Bucket: this.requireBucket(provider),
          Key: this.toPrefixedKey(provider, key),
        }),
      );
      return result.ContentLength ?? null;
    } catch {
      return null;
    }
  }

  // ───────────────────────── Multipart upload (file lớn hơn 5GB) ─────────────────────────
  // PutObject/presigned PUT đơn chỉ nhận tối đa 5GB — giới hạn cứng của chuẩn S3 API, không phải
  // do code hạn chế. File lớn hơn bắt buộc phải chia phần (part 5MB-5GB, tối đa 10.000 phần), mỗi
  // phần ký + PUT riêng rồi "ráp" lại bằng CompleteMultipartUpload. Quy trình chuẩn:
  // createMultipartUpload -> getPresignedUploadPartUrl (từng phần, ngay trước khi PUT phần đó, để
  // không phụ thuộc UPLOAD_EXPIRES_SECONDS cho toàn bộ file) -> completeMultipartUpload (gửi kèm
  // ETag của từng phần, đọc từ response header lúc PUT — bucket cần CORS ExposeHeaders: ["ETag"]
  // thì trình duyệt mới đọc được, xem cloud-files.service.ts).

  async createMultipartUpload(
    providerId: string,
    key: string,
    contentType?: string,
  ): Promise<string> {
    const provider = await this.getProvider(providerId);
    const client = this.buildClient(provider);
    const result = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.requireBucket(provider),
        Key: this.toPrefixedKey(provider, key),
        ContentType: contentType,
      }),
    );
    if (!result.UploadId) {
      throw new Error('Bucket không trả về UploadId cho multipart upload');
    }
    return result.UploadId;
  }

  async getPresignedUploadPartUrl(
    providerId: string,
    key: string,
    uploadId: string,
    partNumber: number,
    expiresInSeconds: number = UPLOAD_EXPIRES_SECONDS,
  ): Promise<string> {
    const provider = await this.getProvider(providerId);
    const client = this.buildClient(provider);
    const command = new UploadPartCommand({
      Bucket: this.requireBucket(provider),
      Key: this.toPrefixedKey(provider, key),
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  }

  async completeMultipartUpload(
    providerId: string,
    key: string,
    uploadId: string,
    parts: { partNumber: number; eTag: string }[],
  ): Promise<void> {
    const provider = await this.getProvider(providerId);
    const client = this.buildClient(provider);
    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.requireBucket(provider),
        Key: this.toPrefixedKey(provider, key),
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [...parts]
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((p) => ({ ETag: p.eTag, PartNumber: p.partNumber })),
        },
      }),
    );
  }

  // Dọn phần đã tải lên dở dang khi user huỷ/lỗi giữa chừng — S3/R2 vẫn tính phí lưu trữ các phần
  // chưa complete nếu không abort tường minh (không tự hết hạn như presigned URL).
  async abortMultipartUpload(
    providerId: string,
    key: string,
    uploadId: string,
  ): Promise<void> {
    const provider = await this.getProvider(providerId);
    const client = this.buildClient(provider);
    await client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.requireBucket(provider),
        Key: this.toPrefixedKey(provider, key),
        UploadId: uploadId,
      }),
    );
  }

  async deleteObject(providerId: string, key: string): Promise<void> {
    const provider = await this.getProvider(providerId);
    const client = this.buildClient(provider);
    await client.send(
      new DeleteObjectCommand({
        Bucket: this.requireBucket(provider),
        Key: this.toPrefixedKey(provider, key),
      }),
    );
  }
}
