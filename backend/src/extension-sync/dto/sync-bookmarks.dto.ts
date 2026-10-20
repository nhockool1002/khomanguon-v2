import { IsObject } from 'class-validator';

// `data` là nguyên khối cây bookmark của K-Extension ({version, trashIds, nodes}, xem
// K-Extension src/storage.js) — không validate chi tiết từng field ở đây vì cấu trúc cây do
// client sở hữu/định nghĩa, backend chỉ lưu và trả lại y nguyên (last-write-wins).
export class SyncBookmarksDto {
  @IsObject()
  data: Record<string, unknown>;
}
