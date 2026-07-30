# Kế hoạch Migration dữ liệu WordPress (v1) → khomanguon v2

## 0. Trạng thái

**Đang chờ:** file SQL export đầy đủ từ WordPress v1 (`mysqldump` toàn bộ database, gồm cả bảng của plugin tuỳ chỉnh — không chỉ bảng lõi `wp_*`).

Tài liệu này là **khung xử lý dựa trên cấu trúc WordPress chuẩn** — mục 3 (mapping chi tiết) sẽ cập nhật lại chính xác sau khi có SQL thật, đặc biệt phần bảng riêng của plugin "Quản lý giao dịch" (đã thấy trong ảnh chụp màn hình `Cài đặt Cloud Settings` — lưu AWS/R2/SePay key) và cơ chế `@CASH` hiện có trên navbar v1, vì đây gần như chắc chắn là bảng tuỳ chỉnh không có trong WordPress core.

---

## 1. Thông tin cần thêm ngoài file SQL

Để mapping chính xác, cần bạn xác nhận/cung cấp thêm:

- [ ] Danh sách plugin đang active trên v1 — đặc biệt: plugin quản lý `@CASH`/ví, plugin gắn link tải trả phí vào bài viết, plugin SEO (Yoast? RankMath? tự viết?)
- [ ] Thư mục `wp-content/uploads` (nếu ảnh/file bài viết còn lưu trên server WP, chưa hoàn toàn ở S3/R2) — hoặc xác nhận toàn bộ ảnh đã ở S3/R2 theo cấu hình trong ảnh Cloud Settings
- [ ] Xác nhận số dư `@CASH` hiện tại của user có phải tiền/giá trị thật cần quy đổi sang `$P` không, hay có thể reset về 0 khi chuyển hệ thống (ảnh hưởng tài chính người dùng — cần bạn quyết định, tôi không tự ý chọn)
- [ ] Có muốn giữ nguyên cấu trúc URL bài viết cũ (`/ten-bai-viet/`) hay chấp nhận đổi sang cấu trúc mới của v2 kèm redirect 301

---

## 2. Bảng WordPress chuẩn dự kiến sẽ dùng (xác nhận lại khi có SQL)

| Bảng WP | Nội dung |
|---|---|
| `wp_users`, `wp_usermeta` | Tài khoản, hồ sơ mở rộng (bio, avatar nếu dùng plugin riêng) |
| `wp_posts` (`post_type='post'`) | Bài viết |
| `wp_posts` (`post_type='attachment'`) | Media library — ảnh đại diện, ảnh trong nội dung |
| `wp_postmeta` | Custom field: SEO meta, thumbnail (`_thumbnail_id`), **rất có thể chứa link tải/giá `@CASH` gắn theo bài viết** — cần soi kỹ khi có SQL |
| `wp_terms`, `wp_term_taxonomy`, `wp_term_relationships` | Danh mục (`category`) và thẻ (`post_tag`) |
| `wp_comments`, `wp_commentmeta` | Bình luận |
| `wp_options` | Cấu hình site: tiêu đề, tagline, GTM/GA ID, reCAPTCHA key... (đã thấy một phần trong Cloud Settings) |
| *(bảng tuỳ chỉnh chưa rõ tên)* | Ví `@CASH`, giao dịch nạp tiền, link tải gắn giá — **cần SQL thật để xác định** |

---

## 3. Mapping dự kiến (bảng WP → model v2)

> Cột "Độ tin cậy" đánh dấu phần nào chắc chắn (dựa trên cấu trúc WordPress chuẩn) và phần nào là **giả định cần xác minh** khi có SQL thật.

| Nguồn (WordPress) | Đích (v2 — `backend/prisma/schema.prisma`) | Ghi chú | Độ tin cậy |
|---|---|---|---|
| `wp_users.user_email` | `User.email` | Unique — cần dò trùng trước khi insert | Chắc chắn |
| `wp_users.display_name` | `User.displayName` | | Chắc chắn |
| `wp_users.user_pass` | ❌ không map trực tiếp | WordPress dùng phpass, khác thuật toán Argon2 của v2 — xem mục 4.1 | Chắc chắn (về việc **không** map được) |
| `wp_users.user_registered` | `User.createdAt` | | Chắc chắn |
| `wp_posts.post_title` | `Post.title` | | Chắc chắn |
| `wp_posts.post_name` | `Post.slug` | Cần kiểm tra unique, giữ nguyên để không vỡ link cũ | Chắc chắn |
| `wp_posts.post_content` | `Post.contentHtml` | Cần làm sạch shortcode/block comment trước khi lưu — xem mục 4.2 | Chắc chắn khung, cần xử lý thêm |
| `wp_posts.post_excerpt` | `Post.excerpt` | | Chắc chắn |
| `wp_posts.post_status` (`publish`/`draft`/`pending`) | `Post.status` (`PUBLISHED`/`DRAFT`/`PENDING_REVIEW`) | | Chắc chắn |
| `wp_posts.post_author` | `Post.authorId` | Map qua `User` đã tạo ở bước trước | Chắc chắn |
| `wp_posts.post_date` | `Post.publishedAt` / `createdAt` | | Chắc chắn |
| `wp_postmeta._thumbnail_id` → `wp_posts.guid` | `Post.thumbnailUrl` | Nếu ảnh đã ở R2/S3 chỉ cần map URL; nếu ở `wp-content/uploads` cần tải + upload lại | Cần xác minh |
| `wp_postmeta` (SEO plugin key, vd `_yoast_wpseo_title`/`_yoast_wpseo_metadesc` hoặc `rank_math_title`) | `Post.metaTitle` / `Post.metaDescription` | Tên field phụ thuộc plugin SEO thật đang dùng | Cần xác minh |
| `wp_term_taxonomy` (`taxonomy='category'`) | `Category` (kèm `parentId` từ `term_taxonomy.parent`) | | Chắc chắn |
| `wp_term_taxonomy` (`taxonomy='post_tag'`) | `Tag` | | Chắc chắn |
| `wp_term_relationships` | `PostTag` / `Post.categoryId` | | Chắc chắn |
| `wp_comments.comment_content` | `Comment.content` | | Chắc chắn |
| `wp_comments.comment_parent` | `Comment.parentId` | Threaded — giữ nguyên cấu trúc | Chắc chắn |
| `wp_comments.user_id` (hoặc `comment_author_email` nếu guest) | `Comment.userId` | Schema v2 hiện **bắt buộc** `Comment.userId` — comment khách (không tài khoản) cần xử lý riêng, xem mục 4.4 | Cần quyết định |
| `wp_options` (site title, GTM/GA, reCAPTCHA...) | `SiteSetting` (key/value) | | Chắc chắn khung, key cụ thể cần đối chiếu |
| *(bảng `@CASH` tuỳ chỉnh)* | `Wallet` / `WalletTransaction` | **Chưa map được — cần SQL thật** | Chưa xác định |
| *(bảng link tải trả phí tuỳ chỉnh)* | `DownloadLink` (cần thêm `StorageProvider` tương ứng trước) | **Chưa map được — cần SQL thật** | Chưa xác định |

---

## 4. Vấn đề kỹ thuật cần quyết định trước khi viết script

### 4.1 Mật khẩu người dùng
WordPress băm mật khẩu bằng **phpass** (`$P$...`), v2 dùng **Argon2** — hai thuật toán không tương thích, không thể "chuyển đổi" hash trực tiếp. Hai phương án:

- **Phương án A (khuyến nghị):** Không migrate password hash. Sau migration, gửi email "đặt lại mật khẩu" hàng loạt cho toàn bộ user cũ (dùng lại UC03 đã có sẵn ở Phase 1). An toàn tuyệt đối, không giữ thuật toán băm cũ trong codebase mới.
- **Phương án B:** Viết một hàm xác thực tương thích phpass **chỉ dùng một lần** tại lần đăng nhập đầu tiên sau migration — nếu đúng, rehash ngay sang Argon2 rồi xoá phpass hash. Phức tạp hơn, thêm code không cần thiết về lâu dài chỉ để tránh việc user phải đặt lại mật khẩu 1 lần.

→ Đề xuất **Phương án A** trừ khi bạn có lý do cụ thể cần giữ trải nghiệm đăng nhập liền mạch.

### 4.2 Làm sạch nội dung bài viết
`post_content` của WordPress có thể chứa:
- Shortcode (`[gallery ids="1,2,3"]`, `[embed]...[/embed]`)
- Block comment của Gutenberg (`<!-- wp:paragraph -->`)
- HTML đặc thù theme/plugin cũ không còn ý nghĩa ở Tiptap

Cần một bước **chuẩn hoá HTML** trong script ETL (regex loại block comment, xử lý riêng shortcode phổ biến) trước khi ghi vào `Post.contentHtml`. Bài nào có shortcode lạ/phức tạp → đưa vào danh sách "cần rà tay" thay vì cố tự động xử lý sai.

### 4.3 Ảnh & file đính kèm
- Nếu ảnh đã ở S3/R2 (theo Cloud Settings đã cấu hình sẵn ở v1) → chỉ cần map URL cũ sang `StorageProvider` tương ứng trong v2, không cần tải lại.
- Nếu còn ở `wp-content/uploads` → cần tải về rồi upload lại lên R2 (bucket production), cập nhật lại URL trong `contentHtml`/`thumbnailUrl`.
- Cần biết chắc trước khi viết script — hỏi ở mục 1.

### 4.4 Bình luận không có tài khoản (guest comment)
Schema `Comment` hiện tại bắt `userId` không rỗng. WordPress cho phép comment không cần tài khoản (chỉ nhập tên/email). Hai lựa chọn:
- Tạo `User` "placeholder" cho mỗi email guest chưa từng đăng ký (status riêng, không có mật khẩu đăng nhập được — chỉ set `passwordHash` ngẫu nhiên vô hiệu hoá), gắn `Comment.userId` vào đó.
- Hoặc nới schema: thêm `guestName`/`guestEmail` optional vào `Comment`, `userId` chuyển thành optional.

→ Đề xuất tạo **User placeholder** — không cần sửa schema, và nếu sau này người đó đăng ký tài khoản thật bằng đúng email, có thể "claim" lại các comment cũ (tính năng để dành, không bắt buộc làm ngay).

### 4.5 Ví `@CASH` cũ
Chưa biết cấu trúc thật (đang chờ SQL). Nếu có số dư/giao dịch thật:
- Không tự động quy đổi 1:1 sang `$P` nếu chưa có tỉ giá đã thống nhất — đây là quyết định tài chính, cần bạn xác nhận rõ bằng văn bản trước khi script chạy lên Production.
- Dù chọn phương án nào, mỗi lần cộng `$P` từ migration phải tạo `WalletTransaction` với `referenceType: "wordpress_migration"` để có dấu vết đối soát sau này.

### 4.6 Idempotency (chạy lại an toàn)
Script migration **phải chạy lại được nhiều lần** mà không tạo bản ghi trùng — vì thực tế sẽ chạy dry-run nhiều lần ở Staging trước khi chạy thật ở Production. Dùng `upsert` theo khoá tự nhiên: `email` (User), `slug` (Post/Category/Tag), `(postId, WP comment_id gốc lưu tạm ở một cột note)` (Comment).

---

## 5. Quy trình thực hiện

1. **Nhận SQL** + trả lời các câu hỏi mục 1
2. **Khảo sát schema thật:** restore SQL vào MySQL tạm (container Docker riêng, không đụng hệ thống dev hiện tại) → đối chiếu với mapping draft ở mục 3, cập nhật lại phần "chưa xác định"
3. **Viết script ETL** (Node.js/TypeScript, đọc nguồn bằng `mysql2`, ghi đích bằng Prisma) — đặt tại `backend/scripts/migrate-wordpress/`
4. **Dry-run:** script chạy ở chế độ chỉ đọc + xuất báo cáo (số bản ghi mỗi loại, danh sách lỗi/bỏ qua ra file JSON/CSV) — **không ghi gì vào DB đích**
5. **Review báo cáo dry-run cùng nhau**, đặc biệt các bản ghi bị đánh dấu lỗi/không map được
6. **Chạy thật lên Staging**, kiểm tra thủ công ngẫu nhiên: vài bài viết (nội dung/ảnh hiển thị đúng), vài user (đăng nhập bằng luồng reset mật khẩu), vài thread bình luận (đúng thứ tự/cha-con)
7. Lặp lại bước 3–6 tới khi số liệu khớp hoàn toàn
8. **Backup DB Production** trước khi chạy thật (bắt buộc, không có ngoại lệ)
9. **Chạy migration thật lên Production** — nên thực hiện ngay trước Go-live (mục 13 `docs/khomanguon-v2-spec.html`) để dữ liệu không bị lệch thêm giữa lúc migrate và lúc mở cửa
10. **Sau go-live:** dựng redirect 301 cho URL cũ nếu đổi cấu trúc slug; gửi email hàng loạt yêu cầu đặt lại mật khẩu (mục 4.1)

---

## 6. Checklist theo dõi

- [ ] 🔴 Nhận file SQL export đầy đủ từ WordPress v1
- [ ] 🔴 Trả lời các câu hỏi mục 1 (plugin đang dùng, vị trí ảnh, quy đổi `@CASH`, giữ URL cũ hay không)
- [ ] Khảo sát SQL thật, cập nhật lại mục 3 của tài liệu này
- [ ] Viết script ETL + chế độ dry-run
- [ ] Review báo cáo dry-run
- [ ] Chạy thật lên Staging + kiểm tra thủ công
- [ ] Chốt phương án mật khẩu (mục 4.1) và `@CASH` (mục 4.5) bằng văn bản
- [ ] Backup Production trước khi chạy
- [ ] Chạy migration Production (ngay trước go-live)
- [ ] Redirect 301 (nếu đổi slug) + email thông báo đặt lại mật khẩu

*(Các mục 🔴 phụ thuộc vào bạn — phần còn lại tôi có thể bắt đầu ngay khi có SQL, không cần chờ tới Phase 4.)*
