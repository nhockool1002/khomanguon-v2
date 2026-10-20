// Tạo (hoặc xoay vòng) ApiClient cho một ứng dụng gọi extension-sync API — hiện chỉ dùng cho
// K-Extension. Key gốc CHỈ in ra console đúng 1 lần (DB chỉ lưu bản hash, xem schema.prisma
// ApiClient) — chép lại ngay và điền vào cấu hình của K-Extension (xem README trong thư mục này).
//
// Cách chạy:
//   pnpm exec tsx scripts/create-api-client.ts --name=k-extension
//   pnpm exec tsx scripts/create-api-client.ts --name=k-extension --rotate   # cấp key mới, vô hiệu key cũ

import { PrismaClient } from '@prisma/client';
import { generateOpaqueToken, hashToken } from '../src/common/token.util';

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const nameArg = argv.find((a) => a.startsWith('--name='));
  const name = nameArg ? nameArg.slice('--name='.length) : null;
  const rotate = argv.includes('--rotate');
  return { name, rotate };
}

async function main() {
  const { name, rotate } = parseArgs(process.argv.slice(2));
  if (!name) {
    console.error('Thiếu --name=<ten-client>, vd: --name=k-extension');
    process.exit(1);
  }

  const existing = await prisma.apiClient.findUnique({ where: { name } });
  if (existing && !rotate) {
    console.error(
      `ApiClient "${name}" đã tồn tại (id=${existing.id}). Dùng --rotate để cấp key mới.`,
    );
    process.exit(1);
  }

  const rawKey = generateOpaqueToken();
  const keyHash = hashToken(rawKey);

  const client = existing
    ? await prisma.apiClient.update({
        where: { id: existing.id },
        data: { keyHash, isActive: true },
      })
    : await prisma.apiClient.create({ data: { name, keyHash } });

  console.log(`ApiClient "${client.name}" (id=${client.id}) sẵn sàng.`);
  console.log('Key gốc (chỉ hiện lúc này, không lưu lại được — chép ngay):');
  console.log(rawKey);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
