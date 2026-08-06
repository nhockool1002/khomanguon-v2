# Migrate WordPress v1 → khomanguon v2

Script ETL đọc trực tiếp file export MySQL của site WordPress cũ (`mysqldump` toàn bộ DB) và ảnh gốc
(`wp-content/uploads`) để nạp vào Postgres của v2. Xem mapping đầy đủ + quyết định đã chốt (quy đổi ví,
môi trường chạy) trong `Migration_Plan.md` ở gốc repo.

## Chuẩn bị

1. Có sẵn 2 thứ trên máy:
   - File `.sql` export đầy đủ từ WordPress v1 (`mysqldump`, gồm cả bảng plugin tuỳ chỉnh `src_khomanguon_*`, `src_point*`).
   - Thư mục ảnh gốc (`wp-content/uploads` đã tách ra riêng, giữ cấu trúc `yyyy/mm/`).
2. Copy `.env.migrate.example` (ở gốc repo) thành `.env`, điền 2 đường dẫn tuyệt đối:
   - `WP_SQL_DUMP_PATH`
   - `WP_PICTURE_DIR`
3. Đảm bảo stack dev chính đã chạy được ít nhất 1 lần (`docker compose up` — cần `backend_node_modules`
   volume đã cài xong dependencies) và roles/permissions đã seed (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`
   trong `backend/.env`, hoặc chạy tay `pnpm --filter backend exec prisma db seed`).

## Chạy

Luôn kèm 2 file compose (override thêm MySQL tạm + mount thư mục ảnh):

```bash
# 1. Dry-run — chỉ đọc, in báo cáo JSON, KHÔNG ghi gì vào Postgres/storage
docker compose -f docker-compose.yml -f docker-compose.migrate.yml run --rm backend \
  pnpm run migrate:wp -- --dry-run

# 2. Xem báo cáo, sửa nếu có lỗi map dữ liệu (thường là ảnh thiếu file hoặc post thiếu author)

# 3. Chạy thật — ghi vào Postgres dev local (docker-compose.yml gốc), ảnh copy vào backend/uploads/
#    (chưa có Storage Provider R2 thật thì ảnh lưu tạm ở local disk, giống UploadsController hiện tại)
docker compose -f docker-compose.yml -f docker-compose.migrate.yml run --rm backend \
  pnpm run migrate:wp

# 4. Sau khi có Access Key/Secret R2 thật (nhập qua Admin > Cài đặt Storage), chạy lại RIÊNG bước
#    ảnh để đẩy lên R2 thật mà không đụng dữ liệu khác đã migrate:
docker compose -f docker-compose.yml -f docker-compose.migrate.yml run --rm backend \
  pnpm run migrate:wp -- --only=attachments
```

Script idempotent — chạy lại bất kỳ lúc nào cũng an toàn (upsert theo email/slug, hoặc kiểm tra tồn
tại trước khi tạo với các bảng không có khoá tự nhiên như Comment/WalletTransaction/DownloadEvent).

## Các bước (chạy tuần tự, dùng `--only=<id>,<id>` để chạy riêng)

| id | Nội dung |
|---|---|
| `users` | `src_users` + `src_usermeta.src_capabilities` → `User`/`UserRole`/`Wallet` rỗng |
| `taxonomy` | `src_terms`/`src_term_taxonomy` → `Category` (cây cha-con) + `Tag` |
| `attachments` | Ảnh gốc trong `WP_PICTURE_DIR` → copy vào `backend/uploads/posts/{yyyy}/{mm}/{dd}/` |
| `posts` | `src_posts` (post) → `Post`, rewrite URL ảnh trong nội dung, gán category/tag/thumbnail |
| `download-links` | `postmeta.custom_key`/`custom_cash` → `DownloadLink`; `src_khomanguon_file_downloads` → `DownloadGrant`/`DownloadEvent` |
| `wallet` | `src_point` → `Wallet.balance` (1:1); `src_point_history` → `WalletTransaction` |
| `comments` | `src_comments` → `Comment` (tạo user placeholder cho khách chưa có tài khoản) |

## Sau khi migrate

- Mở `http://localhost:3000/admin/posts` kiểm tra danh sách bài.
- `DownloadLink` migrate xong sẽ trỏ vào 1 `StorageProvider` placeholder tên **"Legacy R2 (migrated)"**
  (chưa có key thật — key `CHANGE_ME`). Vào **Admin > Cài đặt Storage** sửa lại đúng
  Access Key/Secret/Bucket R2 thật của bucket đang chứa các file trong `object_key`, rồi chạy lại
  `--only=attachments` nếu muốn đẩy luôn ảnh lên R2 thay vì để ở local disk.
- Việc chạy migration này lên Production để lại cho bạn tự quyết định thời điểm, sau khi đã kiểm tra
  kỹ trên dev local (đổi `DATABASE_URL`/`WP_*` tương ứng, KHÔNG chạy tự động từ script này).
