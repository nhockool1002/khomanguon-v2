import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encryptSecret } from '../common/secret-crypto.util';
import { CreateStorageProviderDto } from './dto/create-storage-provider.dto';
import { UpdateStorageProviderDto } from './dto/update-storage-provider.dto';

// Không bao giờ trả secretAccessKeyEncrypted ra API — kể cả đã mã hoá, không có lý do FE cần đọc lại.
const publicSelect = {
  id: true,
  type: true,
  label: true,
  endpoint: true,
  region: true,
  bucket: true,
  uploadPrefix: true,
  accessKeyId: true,
  isDefault: true,
  createdAt: true,
};

@Injectable()
export class StorageProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.storageProvider.findMany({
      orderBy: { createdAt: 'desc' },
      select: publicSelect,
    });
  }

  async create(dto: CreateStorageProviderDto) {
    if (dto.type !== 'MAILJET' && !dto.bucket) {
      throw new BadRequestException('Bucket là bắt buộc với R2/S3');
    }
    if (dto.isDefault) await this.clearExistingDefault();

    return this.prisma.storageProvider.create({
      data: {
        type: dto.type,
        label: dto.label,
        endpoint: dto.endpoint,
        region: dto.region,
        bucket: dto.bucket,
        uploadPrefix: dto.uploadPrefix,
        accessKeyId: dto.accessKeyId,
        secretAccessKeyEncrypted: encryptSecret(dto.secretAccessKey),
        isDefault: dto.isDefault ?? false,
      },
      select: publicSelect,
    });
  }

  async update(id: string, dto: UpdateStorageProviderDto) {
    await this.getOrThrow(id);
    if (dto.isDefault) await this.clearExistingDefault(id);

    return this.prisma.storageProvider.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.endpoint !== undefined && { endpoint: dto.endpoint }),
        ...(dto.region !== undefined && { region: dto.region }),
        ...(dto.bucket !== undefined && { bucket: dto.bucket }),
        ...(dto.uploadPrefix !== undefined && {
          uploadPrefix: dto.uploadPrefix,
        }),
        ...(dto.accessKeyId !== undefined && { accessKeyId: dto.accessKeyId }),
        ...(dto.secretAccessKey !== undefined && {
          secretAccessKeyEncrypted: encryptSecret(dto.secretAccessKey),
        }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
      select: publicSelect,
    });
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    const inUse = await this.prisma.downloadLink.count({
      where: { storageProviderId: id },
    });
    if (inUse > 0) {
      throw new BadRequestException(
        `Không thể xoá — đang có ${inUse} link tải sử dụng storage provider này`,
      );
    }
    await this.prisma.storageProvider.delete({ where: { id } });
  }

  private async getOrThrow(id: string) {
    const provider = await this.prisma.storageProvider.findUnique({
      where: { id },
    });
    if (!provider)
      throw new NotFoundException('Không tìm thấy storage provider');
    return provider;
  }

  // Chỉ 1 provider được đánh dấu mặc định tại một thời điểm — không có constraint DB cho việc này
  // (isDefault là cột Boolean thường) nên xử lý ở tầng service.
  private async clearExistingDefault(excludeId?: string): Promise<void> {
    await this.prisma.storageProvider.updateMany({
      where: { isDefault: true, ...(excludeId && { id: { not: excludeId } }) },
      data: { isDefault: false },
    });
  }
}
