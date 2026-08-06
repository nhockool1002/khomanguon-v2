# KHOMANGUON v2 — Kế hoạch triển khai

> Tài liệu thiết kế đầy đủ (tech stack, kiến trúc, RBAC, use case, wireframe 12 trang, hướng dẫn deploy aaPanel): [`docs/khomanguon-v2-spec.html`](docs/khomanguon-v2-spec.html)

Quy ước: mỗi phase có **Definition of Done (DoD)** rõ ràng — không sang phase tiếp theo khi DoD chưa đạt. Item đánh dấu 🔴 là phụ thuộc bên ngoài (không chỉ code) nên cần khởi động sớm, chạy song song với các phase code.

**Môi trường theo từng giai đoạn:** Phase 0–3 chạy trên **Local (Docker Compose)**; cuối Phase 3 lần đầu đẩy lên **Staging (aaPanel VPS nhỏ)**; Phase 4 chuyển dần sang **Production (aaPanel VPS chính + Cloudflare)**.

> **Cập nhật thực tế (xem chi tiết ở Phase 2.7):** bước Staging riêng đã bị bỏ qua trong triển khai thật — dự án đẩy thẳng lên hạ tầng Production (Vercel cho frontend, aaPanel cho backend) ngay từ sớm, deploy tự động mỗi lần merge vào `main`. Ghi nhận lại đây để không nhầm lẫn khi đọc các mục Phase 3/4 bên dưới.

---

## Tổng quan thời lượng

| Phase | Nội dung | Thời lượng | Môi trường |
|---|---|---|---|
| 0 | Chuẩn bị & khởi tạo dự án | 1 tuần | Local |
| 1 | Nền tảng: Auth, Profile, RBAC cơ bản, CMS core | 4–6 tuần | Local |
| 2 | Nội dung & điều hướng: Menu, bình luận, SEO, custom role | 3–4 tuần | Local → Staging |
| 3 | Kinh tế nội bộ: Ví $P, SePay, Download presigned URL | 4–5 tuần | Staging |
| 4 | Tối ưu, bảo mật, deploy production, go-live | 2–3 tuần | Staging → Production |
| 5 | Hậu launch: vận hành & cải tiến | liên tục | Production |

**Tổng ước tính: ~14–19 tuần (~3.5–4.5 tháng)** cho một team nhỏ (1–2 dev full-stack + 1 phần việc thiết kế/QA kiêm nhiệm). Rút ngắn được nếu thêm người, nhưng Phase 3 (ví tiền) không nên rút gọn vì sai sót ảnh hưởng trực tiếp tiền thật.

---

## Cấu trúc thư mục & quy ước coding hiện tại

> Phần này mô tả kiến trúc **thật** của repo tại thời điểm cập nhật tài liệu này (không phải kế hoạch) — dùng làm tham chiếu bắt buộc khi viết code mới. Quy ước commit/branch/lint đã có sẵn ở [`CONTRIBUTING.md`](CONTRIBUTING.md), không lặp lại ở đây.

### Cấu trúc thư mục

**`backend/src/`** — NestJS, module hoá theo domain (mỗi thư mục = 1 `*.module.ts` + `*.controller.ts` + `*.service.ts` + `dto/`):

| Module | Vai trò |
|---|---|
| `auth/` | Đăng ký/đăng nhập/refresh token, quên/đặt lại mật khẩu, xác minh email |
| `recaptcha/` | Cấu hình + xác minh reCAPTCHA v2 cho đăng ký/đăng nhập |
| `users/` | Hồ sơ user, admin quản lý user, tìm user (autocomplete @mention/filter), trang profile công khai + lời nhắn kiểu guestbook (`ProfileMessage`) |
| `user-activity/` | Ghi nhật ký hoạt động user (đăng nhập, xem bài, nạp tiền, ghé thăm profile người khác) — tab "Hoạt động" công khai ở trang Hồ sơ |
| `roles/` | RBAC: permissions, role CRUD, custom role, style badge role (title/màu/đậm/nghiêng/font) |
| `audit-log/` | Nhật ký thao tác nhạy cảm chỉ Admin xem được (đổi quyền, chỉnh ví tay, đổi key R2/S3) — khác `user-activity/` (công khai, hành vi user thường) |
| `posts/` | Bài viết CRUD, workflow xuất bản |
| `categories/` | Danh mục bài viết |
| `tags/` | Tag bài viết (gắn tag khi soạn bài, trang công khai `/the/[slug]`, quản lý tag ở `/admin/tags`) |
| `menus/` | Menu điều hướng đa cấp (kéo-thả) |
| `comments/` | Bình luận (threaded) + kiểm duyệt + @mention |
| `notifications/` | Thông báo trong app (mention...) + đẩy realtime |
| `widgets/` | Widget sidebar (CMS: tìm kiếm, danh mục, bài mới, HTML tự do, bình luận) |
| `wallet/` | Ví $P — API cho user tự xem + admin điều chỉnh tay (`wallet.adjust`) |
| `sepay/` | Tích hợp SePay: cấu hình, tạo yêu cầu nạp + VietQR, webhook, cron hết hạn đơn |
| `download-links/` | Link tải trả phí gắn bài viết (mua bằng $P, presigned URL, hỗ trợ nhiều link/bài) |
| `link-reports/` | Hàng chờ báo lỗi link tải die, Admin xử lý qua `/admin/link-reports` |
| `storage-providers/` | Cấu hình nhiều provider R2/S3/Mailjet (secret mã hoá, chọn provider mặc định) |
| `storage/` | `r2-client.service.ts` — client S3/R2 dùng chung (AWS SDK thật) cho mọi module cần |
| `cloud-files/` | Duyệt/xoá file trong bucket qua trang admin |
| `db-backup/` | Backup PostgreSQL tự động (cron cấu hình được) + backup thủ công, nén gzip, upload lên storage provider, retention |
| `uploads/` | Upload file chung (ảnh bài viết, avatar, banner...) — lưu đĩa cục bộ theo thư mục ngày kiểu WordPress `uploads/posts/yyyy/mm/dd/` (`common/dated-upload.util.ts`), resize + convert WebP qua `common/image-pipeline.util.ts`, không ghi vào `MediaFile` |
| `settings/` | Cấu hình chung toàn site (số bài viết/trang trang chủ, tiêu đề/slogan/nền banner đầu trang chủ, rate limit) — key/value trong `SiteSetting` (key `general_settings`), theo đúng mẫu `sepay_config` |
| `media/` | Thư viện Media kiểu WordPress — upload/xoá ảnh (`MediaFile` ghi tên gốc + người tải lên), nhưng **liệt kê bằng cách quét trực tiếp đĩa** `uploads/posts/**` (đệ quy) để luôn thấy đủ ảnh dù tới từ `media/` hay `uploads/` |
| `mail/` | Gửi email transactional (xác minh, đặt lại mật khẩu) + email thông báo Admin (nạp tiền/tải file) với template tự chỉnh (`mail_templates` trong `SiteSetting`) |
| `realtime/` | WebSocket gateway (`wallet.gateway.ts`, `notification.gateway.ts`) — mỗi user 1 room riêng, xác thực bằng JWT |
| `cache/` | Object cache Redis (`CacheService`, decorator `@Cacheable()`, `HttpCacheInterceptor`) + webhook purge ISR frontend (`FrontendRevalidateService`) |
| `common/` | Tiện ích dùng chung: mã hoá secret, slugify, token util, filter ẩn tài khoản admin, thư mục upload theo ngày (`dated-upload.util.ts`), pipeline resize/WebP ảnh (`image-pipeline.util.ts`), rate limit công khai (`common/rate-limit/`) |
| `prisma/` | `PrismaService`/`PrismaModule` — client DB dùng chung, `@Global()` |

**`frontend/src/`** — Next.js App Router:

- `app/` — route công khai vẫn tiếng Việt (thân thiện SEO người dùng Việt): `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau`, `/xac-minh-email`, `/bai-viet/[slug]`, `/danh-muc/[slug]`, `/the/[slug]` (trang tag công khai), `/tim-kiem`, `/tai-khoan` (nay chỉ là redirect sang `/nguoi-dung/[id]`, xem Phase 1.2), `/nguoi-dung/[id]` (trang profile công khai, gộp cả "Tài khoản của tôi"), `/sitemap.xml`, `/robots.txt`. **Cập nhật 2026-08-06:** toàn bộ khu quản trị đổi slug sang tiếng Anh — `/quan-tri` → `/admin/*` (`posts`, `categories`, `tags`, `menu`, `widget`, `users`, `transactions`, `comments`, `roles`, `link-reports`, `audit-log`, `cloud-files`, `cloud-files/upload`, `media-library`, `settings/storage`, `settings/sepay`, `settings/email`, `settings/general`, `settings/backup-db` — chưa có trang landing/dashboard riêng cho `/admin`, xem Phase 4.1). Đổi thẳng, không redirect URL cũ (site chưa go-live thật nên chấp nhận cắt).
- `components/` — component dùng chung (UI cơ bản, rich-text-editor, comment-section, mention-textarea, styled-user-name, notification-bell...)
- `context/` — React context (`auth-context`, `role-badges-context`)
- `lib/` — `api.ts` (client có token, tự refresh), `public-api.ts` (fetch phía server không token), `types.ts`, `format.ts`, `fonts.ts`, `socket.ts`

### Quy ước coding đã áp dụng nhất quán — bắt buộc tuân thủ khi thêm code mới

**Backend (NestJS + Prisma):**

1. Mỗi domain là 1 module riêng (`*.module.ts` + `*.controller.ts` + `*.service.ts` + `dto/`) — không gộp nhiều domain vào 1 module, không đặt logic nghiệp vụ trong controller.
2. `PermissionsGuard` chỉ đọc metadata ở **method-level** (`context.getHandler()`) — `@Permissions(...)` phải khai báo lại ở **từng handler**; đặt ở class sẽ bị bỏ qua và guard cho qua mọi user đã đăng nhập (lỗi thật đã gặp và sửa, xem comment đầu `roles.controller.ts`/`storage-providers.controller.ts`).
3. Validate input bằng `class-validator` trong DTO (`@IsString`, `@IsOptional`...) — không validate tay trong service.
4. Secret nhạy cảm (API key, secretAccessKey, webhook key...) luôn mã hoá qua `common/secret-crypto.util.ts` trước khi lưu DB, **không bao giờ lưu plaintext**.
5. Thao tác trừ/cộng $P hoặc ghi nhiều bảng liên quan luôn nằm trong 1 `prisma.$transaction` (ACID) — không tách thành nhiều lệnh rời để tránh lệch số dư.
6. Cấu hình hệ thống không cần bảng riêng thì lưu vào `SiteSetting` (key/value JSON, ví dụ `sepay_config`) thay vì tạo model mới — xem `sepay/sepay-config.types.ts` làm mẫu.
7. Sửa `schema.prisma` thì viết tay migration khớp thay đổi (không chỉ chạy `prisma migrate dev`), đặt tên thư mục `<timestamp>_<mo_ta_ngan>`, luôn chạy `npx prisma generate` sau khi sửa. Trước khi coi một tính năng có đổi schema là xong: chạy `pnpm run build && pnpm run lint && pnpm run test && pnpm run test:e2e` — bài học thật từ dự án: 1 lần merge quên chạy `pnpm run test` đã làm CI đỏ trên `main` và chặn luôn `deploy-backend`.
8. Comment tiếng Việt giải thích **lý do (why)** một quyết định kỹ thuật không hiển nhiên (đánh đổi, lỗi từng gặp, giới hạn cố ý) — không mô tả lại điều code đã tự nói lên.

**Frontend (Next.js App Router):**

1. Trang public (trang chủ, chi tiết bài viết, danh mục...) là **Server Component**, fetch qua `lib/public-api.ts` (`publicFetch` — không token, `cache: "no-store"`).
2. Trang cần đăng nhập (toàn bộ `/admin/*`, `/tai-khoan/*`) là **Client Component** (`"use client"`), fetch qua `lib/api.ts` (`apiFetch` — tự đính access token, tự refresh khi 401).
3. Mọi trang `/admin/*` và `/tai-khoan/*` theo cùng 1 pattern: `useAuth()` lấy `user`, `useEffect` redirect `/dang-nhap` nếu chưa đăng nhập. **Cập nhật 2026-08-04:** mỗi trang giờ tự kiểm tra `user.permissionKeys` (đối chiếu `lib/admin-nav.ts` — nguồn sự thật duy nhất, khớp đúng `@Permissions()` backend) và hiện `<ForbiddenPage />` (trang 403) nếu thiếu quyền, thay vì chỉ dựa vào lỗi 403 backend qua `ErrorBanner` như trước; `admin-sidebar.tsx` cũng ẩn hẳn mục menu (và cả group) mà user không có quyền vào.
4. Style tên user (màu/đậm/nghiêng/font theo role) luôn qua `StyledUserName` + `RoleBadgesProvider` context — không tự tính màu/font riêng lẻ ở từng nơi hiển thị tên.
5. Màu chủ đạo: `#1d3557` (navy — nút chính/link), gradient `#ff5da2 → #ffcf3f` (chip $P), `zinc-*` (Tailwind) cho text/border trung tính.
6. Không thêm thư viện UI framework mới (MUI, Chakra, shadcn...) — toàn bộ giao diện dùng Tailwind thuần + component tự viết trong `components/ui.tsx`.
7. **Cập nhật 2026-08-06:** mọi `apiFetch()` (`lib/api.ts`) tự động phản ánh vào `<GlobalLoadingBar />` (thanh loading mảnh cố định đầu trang, mount ở `layout.tsx`) qua `lib/loading-store.ts` (external store, không phải React Context, để hook được vào hàm thuần) — không cần tự khai báo loading riêng cho hiệu ứng phản hồi tức thời khi bấm action. `SubmitButton` (`components/ui.tsx`) đã có sẵn icon xoay khi `loading=true`, ưu tiên dùng lại thay vì tự viết nút submit riêng.

**Yêu cầu tuân thủ:** mọi PR thêm tính năng mới phải theo đúng cấu trúc module/route và các quy ước 1–8 (backend) / 1–6 (frontend) ở trên. Nếu bắt buộc phải lệch quy ước (thêm thư viện UI mới, đổi provider auth, đổi cách deploy...), phải nêu rõ lý do trong PR description và được review đồng ý trước khi merge — không tự ý đổi kiến trúc khi chỉ đang làm 1 feature nhỏ.

---

## Phase 0 — Chuẩn bị & khởi tạo dự án
**Thời lượng:** 1 tuần · **Môi trường:** Local

- [x] Khởi tạo repo tại [github.com/nhockool1002/khomanguon-v2](https://github.com/nhockool1002/khomanguon-v2) — `frontend/` (Next.js 16) + `backend/` (NestJS + Prisma), chưa dùng workspace `packages/` dùng chung vì 2 app chưa cần share code
- [x] Quy ước code: ESLint (frontend + backend), Prettier (backend) sạch; commit convention (Conventional Commits) + branch strategy trunk-based trong [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [x] Docker Compose dev: `postgres`, `redis`, `backend` (`:4000`, hot reload), `frontend` (`:3000`, hot reload) — `docker compose up` một lệnh, đã build & chạy thử thành công
- [x] ERD chi tiết — thể hiện trực tiếp trong [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma) (users, roles, permissions, role_permissions, posts, categories, menus, comments, wallets, wallet_transactions, download_links, download_grants, storage_providers, site_settings, notifications...)
- [x] Khởi tạo Prisma schema + migration đầu tiên (`prisma migrate dev --name init`) — đã áp dụng, đã qua nhiều migration tiếp theo không lỗi
- [x] CI skeleton (`.github/workflows/ci.yml`): lint + build + unit test + e2e test (kèm Postgres service) cho backend, lint + build cho frontend — chạy trên mọi PR/push `main`
- [x] Đăng ký tài khoản dịch vụ ngoài — **R2/S3 và SePay: xong, tích hợp thật** (`backend/src/storage/r2-client.service.ts` dùng `@aws-sdk/client-s3` thật, `backend/src/sepay/*` gọi API SePay thật + VietQR). 🔴 **Còn thiếu: Sentry (chưa tích hợp ở đâu trong repo) và domain production riêng** — cần làm trước khi vào sâu Phase 4.3/4.4.
- [x] 🔴 VPS + aaPanel cho Staging/Production đã có sẵn (xác nhận từ chủ dự án) — thực tế đã dùng thẳng cho Production (xem ghi chú Phase 2.7)

**DoD:** `docker compose up` chạy được ✅, CI xanh trên PR ✅, schema/migration khớp ERD ✅, R2/S3 + SePay đã cắm thật vào trang Admin ✅. Còn thiếu: tài khoản Sentry (không chặn các phase sau, nhưng phải làm trước khi go-live thật — Phase 4.3/4.4).

---

## Phase 1 — Nền tảng: Auth, Profile, RBAC cơ bản, CMS core
**Thời lượng:** 4–6 tuần · **Môi trường:** Local

### 1.1 Auth & bảo mật tài khoản
- [x] API đăng ký (email + mật khẩu, hash Argon2) + email xác minh (token hash SHA-256, hết hạn 24h, one-time use)
- [x] API đăng nhập (JWT access 15p + refresh 30 ngày xoay vòng, cookie httpOnly `path=/auth`), khoá tạm 15 phút sau 5 lần sai — UC01, UC02
- [x] API quên/đặt lại mật khẩu (token hết hạn 15 phút, one-time use, đổi xong thu hồi hết refresh token) — UC03
- [x] UI Đăng nhập (`/dang-nhap`), Đăng ký (`/dang-ky`), Quên mật khẩu (`/quen-mat-khau`), Đặt lại mật khẩu (`/dat-lai-mat-khau`), Xác minh email (`/xac-minh-email`) — theo wireframe #04/#05, đã test qua trình duyệt thật
- [x] **Đổi thiết kế 2026-08-03 (yêu cầu thực tế):** đăng ký giờ gán role `unverified` (Chưa kích hoạt — không có permission nào) thay vì `member` ngay — chặn tài khoản chưa xác minh email bình luận/xem ví/tải file, "chỉ xem được bài viết" (bài viết vốn public, không cần permission). `verifyEmail()` tự nâng lên `member` ngay khi xác minh thành công (`roles.service.ts` `upgradeAfterVerification` — chỉ đụng vào nếu user còn giữ đúng role `unverified`, không ghi đè nếu Admin đã tự gán role khác). Test e2e đầy đủ: đăng ký → role `unverified` → tạo token xác minh thật (không qua email) → `verify-email` → role `member`.

### 1.2 Hồ sơ người dùng
- [x] API `GET/PATCH /users/me`, `PATCH /users/me/password` (đổi mật khẩu thu hồi hết session), `POST /auth/resend-verification` — UC04. Bổ sung thêm `PATCH /users/me/style-role` (user thuộc nhiều role tự chọn role nào áp style tên hiển thị)
- [x] UI trang `/tai-khoan` với tab Thông tin (tên hiển thị, bio, badge vai trò, banner + nút gửi lại email xác minh) và Bảo mật (đổi mật khẩu) — theo wireframe #06, đã test qua trình duyệt thật. Avatar upload thật (ảnh file) để dành Phase 3 khi có R2/S3 — hiện chỉ nhận `avatarUrl` dạng URL.
- [x] Bổ sung 2026-08-03: giới hạn đổi tên hiển thị — Super Moderator trở lên (quyền `user.manage`) đổi tự do; Moderator trở xuống chỉ đổi được **1 lần trong đời tài khoản** (cột `User.displayNameChangedAt`, `null` = còn lượt free). `PATCH /users/me` trả `400` nếu cố đổi lần 2; `GET /users/me` trả thêm `canChangeDisplayName` để FE khoá ô nhập + hiện đúng thông báo.
- [x] Bổ sung 2026-08-03: trang profile công khai `/nguoi-dung/[id]` — ai cũng xem được (không cần đăng nhập), hiện avatar/tên style theo role/bio/ngày tham gia/tên role, kèm khối "Lời nhắn" kiểu guestbook (`ProfileMessage` model mới, `GET/POST /users/:id/messages`, xoá được bởi tác giả/chủ profile/Moderator+ qua `DELETE /users/:id/messages/:messageId`). `StyledUserName` (`components/styled-user-name.tsx`) nhận thêm prop `userId` tuỳ chọn — bấm tên chuyển sang trang profile; đã áp dụng ở byline bài viết, bình luận, danh sách "Member đã tải" (riêng `PostCard` ở trang chủ không áp được vì cả thẻ đã là 1 `<Link>` bọc ngoài, lồng thêm `<Link>` cho tên tác giả sẽ vi phạm HTML — bấm vào thẻ vẫn mở đúng bài viết, chỉ tên tác giả trong lưới bài viết chưa bấm ra profile riêng được).

### 1.3 RBAC cơ bản
- [x] Bảng `roles`, `permissions`, `role_permissions`, `user_roles`; seed permission + 4 role mặc định (Admin/Super Mod/Mod/Member) đúng ma trận quyền mục 06 tài liệu thiết kế (`prisma/seed.ts`)
- [x] `PermissionsGuard` + `@Permissions(...)` kiểm tra theo mã quyền (không hard-code theo tên role) — đã test 403 đúng khi member gọi endpoint cần `user.manage`
- [x] `GET /users` (list, cần `user.manage`), `POST/DELETE /users/:id/roles` (gán/gỡ role, cần `user.assign_role`) — UC18, đã test admin gán role thành công + member bị chặn. **Cập nhật 2026-08-06:** 2 endpoint này giờ nhận thêm `@CurrentUser() actor` để ghi `AuditLog` (module `audit-log/` mới, xem Phase 4.3) mỗi lần đổi role.
- [x] Bổ sung 2026-08-03: role thứ 5 `unverified` (Chưa kích hoạt) — xem mục 1.1.

### 1.4 CMS bài viết (khung cơ bản)
- [x] Model Post, Category — đã có sẵn từ ERD Phase 0, không cần migration mới. **Cập nhật:** Tag/SEO nâng cao ban đầu ghi "chưa có" ở đây đã lỗi thời — xem Phase 2.4 (module `tags/` + gắn tag khi soạn bài) và Phase 2.1 (panel SEO).
- [x] API CRUD bài viết (chưa có WYSIWYG, chỉ textarea tạm) — `backend/src/posts`, `backend/src/categories`; phân quyền `post.create`/`post.edit.own`/`post.edit.any`/`post.publish`/`post.delete`
- [x] UI trang chủ (wireframe #01), trang danh mục (wireframe #02), chi tiết bài viết (wireframe #03) — bản khung, chưa có link tải/bình luận
- [x] Layout public bám bản sắc v1 (navbar tối, thẻ bài viết, gạch chân gradient — mục 02 tài liệu thiết kế)

### 1.5 Kiểm thử
- [ ] Test unit cho Auth (đăng ký/đăng nhập/reset mật khẩu) — **vẫn chưa có** `auth.service.spec.ts`/`auth.controller.spec.ts` thật sự nào, và luồng quên/đặt lại mật khẩu vẫn hoàn toàn chưa có test tự động (không có trong `auth.e2e-spec.ts`). **Cập nhật 2026-08-06:** riêng dòng "chưa có unit test nào" đã lỗi thời cho phần còn lại của backend — đã có `backend/src/posts/posts.service.spec.ts` (7 case phân quyền sửa bài) và `backend/src/common/slugify.spec.ts`; chỉ Auth cụ thể là còn thiếu. Đã có thay thế một phần: `backend/test/auth.e2e-spec.ts` (Jest + supertest) phủ đăng ký, đăng nhập, refresh token xoay vòng, permission 403, verify-email — nhưng **chưa test luồng quên/đặt lại mật khẩu**. Ưu tiên bổ sung unit test thật trước khi coi mục này xong.

**DoD:** User đăng ký/đăng nhập/sửa hồ sơ được ✅; Admin đăng nhập thấy danh sách bài viết ✅; phân quyền cơ bản chặn đúng theo role ✅. Nợ kỹ thuật còn lại: chưa có unit test riêng cho Auth, chưa test tự động luồng quên/đặt lại mật khẩu (không chặn các phase sau vì đã có e2e coverage một phần).

---

## Phase 2 — Nội dung & điều hướng
**Thời lượng:** 3–4 tuần · **Môi trường:** Local → Staging (deploy thử lần đầu cuối phase)

### 2.1 Soạn thảo & SEO bài viết
- [x] Tích hợp Tiptap (WYSIWYG) + upload ảnh trong nội dung — ảnh lưu tạm ổ đĩa cục bộ (volume Docker riêng) cho tới khi có trang cài đặt R2/S3 ở Phase 3
- [x] Upload thumbnail/ảnh đại diện bài viết (+ ảnh OG) qua file thay vì dán URL
- [x] Panel SEO: meta title/description có đếm ký tự, slug, ảnh OG, xem trước snippet Google — UC14, wireframe #09 (đã áp dụng vào `<head>` trang chi tiết qua `generateMetadata`)
- [x] Workflow trạng thái bài viết: Nháp → Chờ duyệt → Xuất bản, quyền `post.publish` — UC12, UC13 (nút hành động riêng thay vì dropdown, quyền đã enforce từ Phase 1.4)

### 2.2 Menu đa cấp
- [x] Model menu dạng cây (adjacency list: `parent_id`, `order`) — đã có sẵn từ ERD Phase 0
- [x] API CRUD + đổi thứ tự/cấp độ (`backend/src/menus`, quyền `menu.manage`)
- [x] UI kéo-thả bằng dnd-kit, gán hiển thị theo vai trò — UC16, wireframe #10. Lọc menu công khai theo vai trò user cụ thể (không chỉ "công khai/không công khai") để dành bản sau — `AuthUser` context chưa mang theo `roles`.

### 2.3 Bình luận
- [x] Model comment (threaded — `parent_id`), API tạo/trả lời/thích — thêm `Comment.pinned` + model `CommentLike`
- [x] UI bình luận trên trang chi tiết bài viết — UC07, wireframe #03. Bổ sung sau: sort mới nhất/cũ nhất tự chọn được ngay trên UI, filter theo 1 user (cấu hình qua widget Bình luận), @mention kèm gợi ý autocomplete + thông báo realtime, trạng thái loading khi tải bình luận.
- [x] Chức năng kiểm duyệt (ẩn/xoá/ghim, chặn user spam) cho Moderator — UC08. "Chặn user" dùng `PATCH /users/:id/status` (thu hồi refresh token, enforce ở login/refresh). Bổ sung sau: nút "Khoá / Mở khoá" ngay trong bảng `/admin/users` (trước đây phải gọi API tay để mở khoá lại, giờ không cần nữa).

### 2.4 Tìm kiếm & danh mục
- [x] Tìm kiếm full-text (Postgres `tsvector` hoặc Meilisearch nếu traffic lớn) — UC05. **Đơn giản hoá:** dùng `ILIKE` (case-insensitive `contains`) trên title/excerpt thay vì tsvector/Meilisearch — đủ dùng ở quy mô hiện tại, nâng cấp sau khi traffic lớn.
- [x] Lọc theo danh mục/tag, sắp xếp mới nhất/phổ biến — wireframe #02. **Cập nhật 2026-08-06:** dòng "chưa làm lọc theo tag" đã lỗi thời — module `backend/src/tags/` đầy đủ CRUD, trang quản lý tag `/admin/tags`, form soạn bài gửi kèm `tagIds` khi lưu, trang công khai `/the/[slug]` liệt kê bài theo tag (tương đương trang danh mục).

### 2.5 Custom Role đầy đủ
- [x] UI ma trận quyền tick chọn theo module (tạo custom role) — UC17, wireframe #11
- [x] Bổ sung sau: mỗi role tự chỉnh style hiển thị tên user thuộc role đó (màu/đậm/nghiêng/font, chọn 1 trong 20 font) — style áp thẳng lên tên ở bình luận + byline bài viết, không phải badge riêng. Field `title` (nhãn công khai riêng biệt) đã có trong schema/form nhưng **chưa hiển thị ở đâu** — để dành yêu cầu sau.

### 2.6 SEO toàn site
- [x] `frontend/src/app/sitemap.ts` (chuẩn App Router `MetadataRoute.Sitemap`) — liệt kê trang chủ/tìm kiếm/danh mục + toàn bộ bài `PUBLISHED` (duyệt tối đa 10 trang x 50 bài, đủ quy mô hiện tại). `frontend/src/app/robots.ts` — cho phép crawl hết phần công khai, chặn `/admin/` + `/tai-khoan/`, trỏ `Sitemap:` về `sitemap.xml`. Domain lấy từ `NEXT_PUBLIC_SITE_URL` (fallback domain Vercel thật đang chạy).
- [x] Gắn mã Analytics (Google Analytics) + xác minh Google Search Console — UC15. Thêm 2 field `gaTrackingId`/`googleSiteVerification` vào Cài đặt chung (`/admin/settings/general`, mục "SEO toàn site"); `layout.tsx` chuyển từ `export const metadata` tĩnh sang `generateMetadata()` để đọc `googleSiteVerification` lúc request-time (render `<meta name="google-site-verification">`), và tự chèn `gtag.js` (`next/script`, `strategy="afterInteractive"`) khi có `gaTrackingId`. Để trống thì không render gì cả (mặc định).

### 2.7 Deploy thử Staging
- [x] ~~Chuẩn bị VPS staging trên aaPanel~~ — **thực tế bị bỏ qua**: dự án dùng aaPanel VPS làm thẳng hạ tầng Production, không tách môi trường Staging riêng như kế hoạch ban đầu.
- [x] ~~Deploy bản build đầu tiên lên staging~~ — thay vào đó deploy thẳng: frontend qua Vercel (`khomanguon-v2.vercel.app`), backend qua aaPanel + Docker (`kmn2api.nhutnm.id.vn`), cả hai đã chạy thật và được xác nhận healthy. Chi tiết CI/CD ở Phase 4.4.

**DoD:** Mod đăng bài đầy đủ SEO ✅, Admin duyệt bài ✅, menu kéo-thả hoạt động đúng thứ tự ✅, user bình luận/kiểm duyệt được ✅, custom role tạo được từ UI ✅, bản deploy thật chạy được qua domain (bỏ qua bước staging, đi thẳng production — xem ghi chú 2.7). Còn thiếu trước khi chuyển hẳn sang Phase 2.6: sitemap/robots.txt, Search Console/Analytics.

---

## Phase 3 — Kinh tế nội bộ: Ví $P, SePay, Download trả phí
**Thời lượng:** 4–5 tuần · **Môi trường:** đã deploy thẳng lên Production (xem ghi chú Phase 2.7), không qua Staging riêng

> Phase nhạy cảm nhất — mọi thao tác trừ/cộng tiền phải nằm trong 1 DB transaction, có test E2E riêng.

### 3.1 Ví $P
- [x] Model `wallets`, `wallet_transactions` (ACID) — mọi thao tác cộng/trừ nằm trong `prisma.$transaction`
- [x] UI trang Ví & lịch sử giao dịch — UC10, wireframe #07 (`/tai-khoan/vi`), cập nhật số dư realtime qua WebSocket
- [x] Bổ sung sau: trang Admin "Quản lý giao dịch" (`/admin/transactions`) — xem toàn bộ giao dịch mọi user, lọc theo loại/trạng thái/email, điều chỉnh số dư tay theo email (dùng đúng quyền `wallet.adjust` đã khai báo sẵn nhưng chưa dùng tới trước đó)
- [x] Bổ sung 2026-08-03: bảng giao dịch sort được (bấm tiêu đề cột Thời gian/Loại/Số tiền/Số dư sau GD/Trạng thái — tự viết bằng Tailwind, không thêm thư viện datatable ngoài, đúng quy ước dự án), server-side qua `sortBy`/`sortDir` ở `GET /wallet/admin/transactions`. Nút "🗑 Xoá theo bộ lọc" gọi `DELETE /wallet/admin/transactions` (quyền `wallet.adjust`) xoá hàng loạt đúng theo bộ lọc type/status/q đang áp dụng — bắt buộc phải chọn ít nhất 1 điều kiện lọc (chặn cả 2 phía FE/BE) để tránh xoá nhầm toàn bộ lịch sử; chỉ xoá bản ghi `WalletTransaction`, không đụng `Wallet.balance` nên không làm sai số dư hiện tại.
- [x] Bổ sung 2026-08-03: giao dịch `PURCHASE` từ mua link tải giờ ghi kèm `note` = "Tên bài viết — tên file" (`download-links.service.ts` `unlock()`) — trước đó cột "Ghi chú / Tham chiếu" chỉ có `referenceType:referenceId` dạng id thô, Admin không biết ngay giao dịch ứng với game/file nào nếu không tra riêng.

### 3.2 Nạp tiền qua SePay
- [x] API tạo yêu cầu nạp tiền + sinh mã QR VietQR (trạng thái `pending`)
- [x] Webhook nhận xác nhận từ SePay: chống gọi trùng (unique theo mã giao dịch SePay, đã test idempotent) — UC09, UC23. **Lệch với kế hoạch ban đầu:** xác thực bằng API Key header (`Authorization: Apikey ...`, đúng chế độ webhook thật của SePay) thay vì chữ ký HMAC như dự tính lúc đầu — đây là lựa chọn có chủ đích, không phải thiếu sót.
- [x] Đẩy realtime số dư mới qua WebSocket sau khi webhook xử lý xong (`realtime/wallet.gateway.ts`)
- [x] Cron huỷ giao dịch `pending` quá hạn (30 phút) — `sepay-cron.service.ts`, chạy mỗi phút

### 3.3 Link tải & giá $P
- [x] Model `download_links` (gắn Post, provider R2/S3, object key, giá $P)
- [x] UI quản lý link tải trong trình soạn bài — wireframe #09. **Cập nhật 2026-08-06:** giới hạn "mỗi bài viết chỉ 1 link tải chính" đã được gỡ bỏ — `download-links.service.ts` giờ hỗ trợ đầy đủ CRUD nhiều link/bài (`unlock(userId, linkId, ...)` thao tác theo `linkId` cụ thể, không còn ngầm định link sớm nhất), FE `download-config-panel.tsx` có nút "+ Thêm link tải" quản lý danh sách. Có ô "Dung lượng (byte)" + nút "Dò dung lượng" (đọc thật từ bucket qua `GET /storage-providers/:id/files`) — trước đó form không gửi `sizeBytes` nên mỗi lần lưu tự xoá về `null`, khối "Dung lượng" ở trang bài viết luôn hiện "—" (đã sửa 2026-08-03). **Bổ sung cùng ngày:** các link tải tạo từ trước khi có ô này (đang có `sizeBytes = null` sẵn trong DB) không cần Admin vào sửa lại tay — `getPublicInfo()` tự HEAD object lấy dung lượng thật (`R2ClientService.headObjectSize`) và lưu ngược vào DB ngay lần đầu có người xem trang chi tiết bài viết đó, các lần sau đọc thẳng từ DB (không gọi lại S3/R2 mỗi request).
- [x] API mua + sinh presigned URL: kiểm tra số dư → trừ tiền (1 transaction) → gọi SDK R2/S3 thật → TTL 10 phút — UC11, UC24
- [x] **Đổi thiết kế 2026-08-03 (yêu cầu thực tế, khác Phase 3 ban đầu):** bỏ hẳn cơ chế "mở khoá 1 lần → tải lại miễn phí mãi mãi" qua `DownloadGrant.expiresAt` — **mỗi lượt tải đều kiểm tra + trừ $P**, kể cả user đã tải trước đó (gọi `POST /posts/:postId/download-link/unlock` là luôn trừ tiền nếu `priceP > 0`, không có ngoại lệ). `DownloadGrant` vẫn được ghi mỗi lượt tải thành công nhưng chỉ còn là lịch sử mua (phục vụ tính doanh thu/danh sách member ở `cloud-files.service.ts`), không còn dùng để bỏ qua thanh toán. Trường `hasAccess` đã bỏ khỏi API công khai (`GET /posts/:postId/download-link`) vì không còn ý nghĩa. Đẩy realtime số dư qua WebSocket ngay sau khi trừ tiền (trước đó `download-links.service.ts` không emit, chip $P ở navbar không tự cập nhật sau khi tải).
- [x] Sửa cùng ngày: `DownloadBox` (FE) trước đó vẫn giữ lại presigned URL trong state sau khi mở khoá thành công và hiện thành 1 link "Tải xuống ngay" bấm lại được thoải mái mà KHÔNG gọi lại API — tức bên BE đã tính đúng "mỗi lần tải trừ $P" nhưng FE lại cho tải lại miễn phí trong cùng phiên xem trang (không khớp yêu cầu). Đã bỏ hẳn state lưu link tải — nút luôn quay về trạng thái khoá "🔒 Mở khoá & tải xuống — X $P" ngay sau khi mở tab tải, bấm lại luôn tính 1 lượt mở khoá mới (gọi lại `unlock()`, trừ $P mới).
- [x] Bổ sung 2026-08-03: khối "Member đã tải" ở `DownloadBox` style đúng theo cài đặt style role (màu/đậm/nghiêng/font) — trước đó chỉ là plain text (`downloaderNames: string[]`). `getPublicInfo()` giờ trả `downloaders: { displayName, styleRoleSlug }[]` (dùng lại `resolveStyleRoleSlug` — đúng util đã dùng cho byline bài viết/bình luận), FE render qua `StyledUserName` thay vì nối chuỗi.

### 3.4 Cài đặt hệ thống liên quan
- [ ] Trang cài đặt Key R2/S3 (nhiều provider, nút test kết nối, chọn mặc định) — UC20, wireframe #12. **Đã có:** CRUD nhiều provider + chọn mặc định (`isDefault`). **Còn thiếu:** nút "Test kết nối" (không có endpoint/route nào cho việc này ở `storage-providers`, khác với SePay đã có `testApiConnection` thật).
- [x] Trang cài đặt SePay (API key, webhook secret) + tỉ giá VNĐ↔$P, gói nạp khuyến mãi — UC21, đầy đủ kèm nút "Test kết nối API" thật

### 3.4b Cài đặt chung & Thư viện Media (ngoài kế hoạch ban đầu — bổ sung theo yêu cầu 2026-08-03)
- [x] Trang "Cài đặt chung" (`/admin/settings/general`, quyền `settings.general`) — chỉnh số bài viết/trang ở trang chủ, tiêu đề nhỏ + slogan banner đầu trang chủ, màu nền hoặc ảnh nền (chọn `background-size`/`background-attachment`, kéo chuột chọn `background-position` tự do). Lưu vào `SiteSetting` (key `general_settings`, service `settings/site-settings.service.ts`), đọc công khai qua `GET /settings/general` (không cần đăng nhập) để `frontend/src/app/page.tsx` (Server Component) render banner + phân trang theo cấu hình thay vì hằng số `PAGE_SIZE = 9` cũ.
- [x] Thư viện Media kiểu WordPress (`/admin/media-library`, quyền `media.manage`) — lưới thumbnail cùng kích thước (giống hệt trang Media Library của WordPress), bấm vào mở modal xem chi tiết (dung lượng/loại/người tải/ngày/đường dẫn), copy URL, xoá, upload nhiều ảnh cùng lúc (`POST /media`, `GET /media`, `DELETE /media?path=`). Mọi ảnh upload qua endpoint chung `POST /uploads` (nội dung bài viết, avatar, ảnh nền banner...) và qua `/media` đều lưu vào cùng cây thư mục theo ngày kiểu WordPress `uploads/posts/yyyy/mm/dd/` (`backend/src/common/dated-upload.util.ts`) — Thư viện Media **quét trực tiếp từ đĩa** (đệ quy, bao gồm thư mục con) nên luôn thấy đủ ảnh từ mọi nguồn, không phụ thuộc 1 bảng DB duy nhất để liệt kê. Model `MediaFile` (migration `20260803120000_add_media_files`) chỉ dùng để bổ sung tên gốc + người tải lên cho ảnh tải qua `/media` — ảnh tải qua `/uploads` cũ vẫn hiện ra trong thư viện nhưng chỉ có tên file UUID vật lý (không có tên gốc/người tải, vì endpoint đó không ghi DB).

### 3.4c Email thông báo qua Mailjet (ngoài kế hoạch ban đầu — bổ sung theo yêu cầu 2026-08-03)
- [x] Gửi email nội bộ cho Admin khi user nạp tiền thành công (`sepay.service.ts` `matchAndCredit()`) hoặc tải file thành công (`download-links.service.ts` `unlock()`) — tái dùng transport Mailjet đã có sẵn trong `MailService.getTransporter()` (ưu tiên `StorageProvider` loại `MAILJET` đã cấu hình ở Cài đặt Storage, fallback `SMTP_HOST` env). Cả 2 điểm gọi đều **không `await`** (fire-and-forget, tự bắt lỗi bên trong) — gửi mail là side-effect phụ, không được làm chậm phản hồi webhook SePay (UC23 cần trả lời nhanh, không thì SePay retry) hay việc trả link tải về cho user.
- [x] Template email admin có thể tự chỉnh — trang `/admin/settings/email` (quyền `settings.mail`), 2 template (tiêu đề + HTML) cho 2 sự kiện trên, cú pháp biến `{{tenBien}}` (thay thế chuỗi đơn giản, không thêm thư viện template engine). Lưu trong `SiteSetting` (key `mail_templates`, theo đúng pattern key/value chung). Có ô "Email nhận thông báo" và nút "Gửi thử" mỗi template (`POST /mail/templates/test-send/:kind`, dữ liệu mẫu + gửi thật tới cả người nhận cấu hình lẫn email admin đang bấm nút) để xác nhận cấu hình Mailjet/SMTP hoạt động mà không cần chờ có giao dịch/lượt tải thật.
- [x] Email gửi từ (`MAIL_FROM`) mặc định `admin@khomanguon.org` (đổi từ `no-reply@khomanguon.local` cũ — cả code lẫn `.env.example`), dùng chung cho mọi email hệ thống kể cả xác minh/đặt lại mật khẩu. Vẫn đổi được qua env nếu cần (vd domain chưa xác thực ở Mailjet).
- [x] **Sửa 2026-08-03 (yêu cầu thực tế):** email nạp tiền/tải file giờ LUÔN gửi tới **cả 2 nơi** — email Admin cấu hình sẵn (mặc định `nhut.nguyenminh.it@gmail.com`, đổi được ở trang Cài đặt Email) **và** đúng email của user vừa thực hiện giao dịch (dùng như email xác nhận) — trước đó chỉ gửi 1 nơi (notifyEmail), user không nhận được xác nhận riêng. `MailService.send()` nhận `to` dạng mảng để gửi nhiều người nhận cùng lúc.

### 3.5 Chống lạm dụng
- [x] Log IP mỗi lần tải — `DownloadEvent.ipAddress` ghi mỗi lần `unlock()`
- [x] Rate limit lượt tải/IP — `DownloadRateLimitGuard` (`backend/src/download-links/download-rate-limit.guard.ts`), sliding window trong bộ nhớ (10 request/phút/IP) áp cho `POST /posts/:postId/download-link/unlock`, trả `429`. **Có chủ đích không dùng `@nestjs/throttler`/Redis** — hiện chỉ chạy 1 instance backend (docker-compose không replica, giống lý do `realtime/wallet.gateway.ts` không cần Redis adapter); nếu scale ngang nhiều instance sau này phải chuyển bộ đếm này sang Redis để đúng across instances.
- [x] Chức năng báo lỗi link die → hàng chờ xử lý — UC25 — model `LinkReport` mới (migration additive), nút "🔗 Báo lỗi link" ở `DownloadBox`, hàng chờ Admin ở `/admin/link-reports`, email Admin khi có báo cáo mới + email người báo cáo khi xử lý xong (2 template `linkReportAdmin`/`linkReportResolved` tự chỉnh ở `/admin/settings/email`). **Lệch với kế hoạch ban đầu:** dùng lại quyền `download.manage_links` có sẵn (Admin + Super Moderator) thay vì tạo permission riêng cho "Moderator" — tránh đổi RBAC trên DB production đang chạy thật. PR #43.

### 3.6 Kiểm thử bắt buộc
- [ ] Test E2E (Playwright) luồng nạp tiền: tạo yêu cầu → webhook giả lập → số dư cập nhật đúng — **chưa làm, chưa cài Playwright ở đâu trong repo**
- [ ] Test E2E luồng tải file: đủ/không đủ số dư, trừ đúng 1 lần dù bấm nhiều lần (idempotency) — **chưa làm**
- [ ] Test webhook bị gọi lại (replay) không cộng tiền 2 lần — **chưa có test tự động**, cơ chế chống trùng đã có trong code (`SepayTransaction.sepayTransactionCode` unique) nhưng chưa được test bằng 1 e2e-spec cụ thể

### 3.7 UX & vận hành bổ sung (ngoài kế hoạch ban đầu — bổ sung 2026-08-05, PR #43)
- [x] Fix bug upload file lớn (>5GB) qua multipart bị lỗi "Lỗi mạng lúc tải phần 1" — nguyên nhân: `@aws-sdk/client-s3` bản mới tự thêm checksum vào request đã ký (presigned URL), trình duyệt PUT thô không gửi đúng checksum đó nên bị R2 từ chối. Tắt bằng `requestChecksumCalculation`/`responseChecksumValidation: 'WHEN_REQUIRED'` ở `r2-client.service.ts`. Kèm hướng dẫn cấu hình CORS bucket R2 ngay trên trang Upload (trước đây chưa tài liệu hoá ở đâu). **Chưa verify được bằng bucket R2 thật** (sandbox không có credential) — cần chủ dự án tự upload thử lại 1 file lớn để xác nhận.
- [x] Tooltip cho tiêu đề bài viết ở mọi nơi có thể bị cắt ngắn (PostCard, PostRow, PostPopup, widget "Bài mới", bảng admin) — **đính chính:** không phải thuộc tính `title="..."` native (không tin cậy, không style được) mà là component `Tooltip` tự viết (`components/ui.tsx`).
- [x] Đếm lượt xem bài viết chống spam F5 — tách hẳn khỏi route `GET /posts/:slug` (vốn được Next.js Server Component gọi từ server, không thấy IP người xem thật) sang endpoint riêng `POST /posts/:id/view` gọi từ trình duyệt, dedup 30 phút/người xem (ưu tiên userId, fallback IP). Thêm `app.set('trust proxy', 1)` ở `main.ts` — cải thiện luôn độ chính xác IP cho `DownloadRateLimitGuard`/`DownloadEvent` có sẵn.
- [x] Widget mới "Bài viết xem nhiều" (`TOP_VIEWED`) — số lượng tuỳ chọn, dùng lại `sort=popular` đã có.
- [x] Trang Admin `/admin/users`: bấm email user → mở trang profile công khai (tab mới).
- [x] User Activity log — model `UserActivity` mới, ghi lại đăng nhập/xem bài viết/nạp tiền/ghé thăm profile người khác, tab "Hoạt động" ở trang Hồ sơ. **Đính chính 2026-08-06:** endpoint thật là `GET /users/:id/activity`, **công khai** (không cần đăng nhập, ai cũng xem được — giống trang Hồ sơ công khai), không phải `GET /users/me/activity` riêng tư như ghi ban đầu. Việc ghi nhận `VISIT_PROFILE` (ghé thăm profile người khác) từng bị lỗi (endpoint cũ dùng `OptionalJwtAuthGuard` nhưng FE gọi qua `publicFetch()` không gửi token nên viewer không bao giờ được nhận diện) — đã sửa bằng endpoint riêng `POST /users/:id/visit` (`JwtAuthGuard`, gọi từ client sau khi mount trang profile). PR #46.

**DoD:** Nạp tiền qua SePay thành công và cộng đúng $P ✅ (đã chạy thật trên production, xem lịch sử giao dịch thật đã có dữ liệu); mua link tải trừ đúng tiền, tải được file qua presigned URL còn hạn ✅; webhook gọi trùng không gây cộng/trừ tiền sai ✅ (theo code, chưa có test tự động xác nhận); báo lỗi link die + hàng chờ xử lý ✅ (mục 3.5). Còn nợ: nút test kết nối R2/S3 (mục 3.4), toàn bộ bộ test E2E Playwright của phase này (mục 3.6), verify thật bug upload file lớn trên bucket production (mục 3.7). (Rate limit toàn site đã xong ở Phase 4.3, xem cập nhật 2026-08-06.)

---

## Phase 4 — Tối ưu, bảo mật & Go-live
**Thời lượng:** 2–3 tuần · **Môi trường:** đã ở Production (xem ghi chú Phase 2.7 — bước Staging→Production coi như đã gộp làm một)

### 4.1 Dashboard quản trị
- [ ] Thống kê doanh thu, user mới, bài viết chờ duyệt, lượt tải — UC22, wireframe #08 — **chưa làm**, `/admin` chưa có trang landing/dashboard nào (chỉ có `layout.tsx`, các trang con phải vào thẳng URL cụ thể)

### 4.2 Tối ưu tốc độ (theo mục 09 tài liệu thiết kế)
- [x] ISR cho toàn bộ trang public — `frontend/src/lib/public-api.ts`'s `publicFetch()` đổi từ `cache: "no-store"` sang `next: { revalidate: 30 }` (mặc định 30s cho mọi fetcher: bài viết, danh mục, menu, widget, cài đặt chung...). Next.js tự suy ra thời gian revalidate của cả route từ các lệnh fetch dùng trong Server Component nên không cần khai báo `export const revalidate` riêng ở từng `page.tsx`. **Cập nhật 2026-08-04:** webhook purge cache Next.js đã có — `frontend/src/app/api/revalidate/route.ts` (`revalidatePath("/", "layout")`, xác thực header `x-revalidate-secret` so với `REVALIDATE_SECRET`), gọi từ `FrontendRevalidateService` (`backend/src/cache/frontend-revalidate.service.ts`). **Cập nhật 2026-08-06:** `posts.service.ts` (`create`/`update`/`remove`) giờ gọi kèm `frontendRevalidate.revalidateAll()` ngay sau `cache.invalidatePrefix('posts')` — publish/sửa/xoá bài tự động purge ISR frontend, không còn phải đợi Admin bấm tay nút "Xoá cache". PR #46.
- [ ] Cache Cloudflare Edge cho trang public + asset tĩnh — **chưa làm** (cấu hình dashboard Cloudflare, không phải việc trong code)
- [x] Redis cache cho query nóng (bài mới, đếm lượt tải) — **Cập nhật 2026-08-04:** object cache kiểu WP-Rocket/LiteSpeed đã làm đầy đủ ở `backend/src/cache/` (`CacheService` dùng `ioredis`, cache-aside qua decorator `@Cacheable()` + `HttpCacheInterceptor`, key có tiền tố `kmg:cache:` để xoá chọn lọc bằng `SCAN`, fail-open khi Redis lỗi). Gắn cho `posts`/`categories`/`menus`/`widgets`/`roles`/`site-settings`, tự `invalidatePrefix(namespace)` ngay sau mỗi lần ghi (create/update/xoá/reorder). Nút "Xoá cache" trên topbar (quyền `cache.manage`, thường chỉ Admin) dọn sạch toàn bộ Redis + gọi kèm webhook revalidate frontend ở trên. PR #36 (`90bbe3d`).
- [x] Pipeline ảnh: resize + WebP khi upload — **Cập nhật 2026-08-06:** thêm dependency `sharp`, util dùng chung `backend/src/common/image-pipeline.util.ts` (resize tối đa 1920px + convert WebP quality 82, bỏ qua GIF để giữ animation), áp cho cả 2 điểm upload ảnh trong hệ thống (`POST /uploads` và `POST /media`). **Chưa làm:** AVIF, lazy-load phía FE (Next.js `<Image>` component chưa được dùng — hiện toàn dùng `<img>` thô kèm `eslint-disable @next/next/no-img-element`, tách task riêng nếu cần). PR #46.
- [ ] Giảm JS client: tối đa hoá React Server Components — chưa rà soát riêng, mặc định theo hành vi Next.js
- [x] **Bổ sung 2026-08-06 (UX, ngoài kế hoạch ban đầu):** cơ chế loading toàn cục — trước đó bấm action gọi API không có phản hồi hình ảnh gì cho tới khi response về, cảm giác trang bị đứng/chậm. Thêm `frontend/src/lib/loading-store.ts` (external store đếm request đang chạy) hook thẳng vào `apiFetch()` (`lib/api.ts`), và `<GlobalLoadingBar />` (thanh gradient thương hiệu chạy ở đầu trang, `useSyncExternalStore`) mount 1 lần ở `layout.tsx` — tự động hiện/ẩn theo MỌI lệnh gọi API qua `apiFetch`, không cần từng trang tự khai báo. `SubmitButton` (`components/ui.tsx`) bổ sung icon `Loader2` xoay khi `loading=true` (trước chỉ đổi chữ thành "Đang xử lý...").

### 4.3 Bảo mật
- [ ] Rà soát OWASP Top 10 (đặc biệt XSS trong output WYSIWYG, CSRF, injection) — chưa có bằng chứng đã rà soát có hệ thống
- [x] Rate limit toàn bộ API công khai (đăng nhập, tìm kiếm, tải) — **Cập nhật 2026-08-06:** phát hiện hạ tầng thực ra **đã có sẵn từ trước** (`backend/src/common/rate-limit/` — `PublicRateLimitService`/`PublicRateLimitGuard`/`@RateLimitKey()`, cấu hình qua `SiteSetting.rateLimits`, chỉnh được ở trang Cài đặt chung), đã áp cho login/register/forgotPassword/search — dòng "chưa làm" trước đây đã lỗi thời. Vá nốt lỗ hổng còn lại: `POST /auth/reset-password` (đặt lại mật khẩu) trước đó không có guard nào — đã thêm key `resetPassword` (`900s/5 lượt`) + guard. Có chủ đích **không** dùng `@nestjs/throttler` — giữ đúng kỹ thuật sliding-window trong bộ nhớ nhất quán với `DownloadRateLimitGuard` (lý do: chỉ chạy 1 instance backend). PR #46.
- [x] Audit log cho thao tác nhạy cảm: đổi quyền, điều chỉnh ví thủ công, đổi key R2/S3 — **Cập nhật 2026-08-06:** model `AuditLog` mới (migration `20260806010000_add_audit_log`) + `AuditLogService`/`AuditLogModule`, ghi log tại `users.service.ts` (`assignRole`/`removeRole`), `wallet.service.ts` (`adjustBalance`, ghi trong cùng `$transaction`), `storage-providers.service.ts` (`update`, chỉ khi đổi `accessKeyId`/`secretAccessKey`). Trang xem log `/admin/audit-log` (quyền `audit.view`, mặc định chỉ Admin). PR #46.

### 4.4 Hạ tầng Production — Vercel (frontend) + aaPanel (backend)
- [x] 🔴 Làm theo thứ tự trong [`Deploy_Checklist.md`](Deploy_Checklist.md) — đã deploy thật, cả 2 domain đang chạy
- [x] Import repo lên Vercel (Root Directory `frontend`) — `khomanguon-v2.vercel.app` đang chạy, deploy tự động mỗi lần merge `main`
- [x] Setup aaPanel cho backend (Docker Compose: postgres/redis/backend) — `kmn2api.nhutnm.id.vn` đang chạy, health check `{"status":"ok","db":"up"}`
- [x] Cấu hình CORS/cookie cross-origin đúng — đã xác nhận `Access-Control-Allow-Origin` trả đúng domain Vercel, đăng nhập + giữ phiên hoạt động qua domain production
- [x] CI/CD backend — **cách làm thực tế khác với kế hoạch ban đầu:** job `deploy-backend` trong `.github/workflows/ci.yml` SSH thẳng vào VPS, `git reset --hard origin/main` rồi `docker compose up -d --build` build lại image ngay trên VPS + `prisma migrate deploy` + `prisma db seed` — **không** build image đẩy lên GHCR rồi pull như dự tính ban đầu. Job này chạy **tự động** mỗi khi có push vào `main` sau khi job `backend` (lint/build/test) xanh — **không có bước duyệt thủ công** như kế hoạch ban đầu yêu cầu. ⚠️ Rủi ro cần lưu ý: 1 lần merge quên chạy test đã từng làm hỏng CI và chặn deploy — nếu muốn thêm gate duyệt thủ công (`environment:` protection rule trên GitHub) thì cần làm trước khi tăng tần suất merge.
- [x] Backup PostgreSQL tự động hàng ngày — **Cập nhật 2026-08-06:** dòng "chưa làm" đã lỗi thời, module `db-backup/` đầy đủ: cron cấu hình được (bật/tắt, giờ/phút, chạy mỗi phút kiểm tra `hasRunToday()`, mặc định **tắt** — Admin phải tự bật ở `/admin/settings/backup-db`), `pg_dump` nén gzip, upload lên storage provider (R2/S3) đã chọn, retention (`retentionCount`, mặc định giữ 7 bản), nút "Backup ngay" chạy thủ công, tải lại bản backup qua presigned URL. **Còn thiếu thật:** chưa có tính năng restore/import ngược lại từ file backup (chỉ tải file gzip về, phục hồi vẫn phải làm tay/ngoài hệ thống) — mục "đã thử restore ít nhất 1 lần" trong tiêu đề vẫn chưa làm được vì thiếu chính công cụ restore. **Bổ sung cùng ngày:** thêm `DELETE /db-backup/records/:id` + nút "Xoá" ở Lịch sử backup (xoá cả object trên bucket lẫn record DB, best-effort giống `applyRetention()`).
- [ ] Giám sát: Sentry (lỗi, cả frontend lẫn backend), Uptime Kuma (uptime cả 2 domain), theo dõi tài nguyên VPS aaPanel — **chưa làm**, chưa tích hợp Sentry hay Uptime Kuma ở đâu

### 4.5 Dữ liệu & nội dung
- [ ] 🔴 Migrate dữ liệu từ WordPress v1 sang v2 — kế hoạch chi tiết ở [`Migration_Plan.md`](Migration_Plan.md). Repo đã có `backend/scripts/migrate-wordpress/` (nhiều bước ETL) và `docker-compose.migrate*.yml` — script ETL đã được viết, cần xác nhận với chủ dự án đã chạy thật trên production hay còn ở giai đoạn dry-run.
- [ ] 🔴 Soạn điều khoản sử dụng, chính sách hoàn tiền $P, chính sách bản quyền mã nguồn chia sẻ

### 4.6 Go-live (checklist đầy đủ ở mục 13 tài liệu)
- [x] DNS + SSL production hoạt động, force HTTPS — cả 2 domain đã chạy HTTPS thật
- [ ] Chuyển toàn bộ key sandbox → key production (SePay, R2/S3), xoá key dev khỏi `.env` — cần chủ dự án xác nhận key hiện tại trên production đã là key thật hay vẫn sandbox
- [ ] Test nạp tiền thật với số tiền nhỏ trên production — cần xác nhận đã thử hay chưa
- [ ] Test tải file thật trên bucket production — cần xác nhận đã thử hay chưa
- [ ] Rollback plan sẵn sàng (giữ image tag bản trước) — chưa có, cách deploy hiện tại (`git reset --hard` + rebuild) không tự giữ lại bản trước để rollback nhanh
- [ ] 🔴 Thông báo người dùng v1 về thời điểm chuyển đổi (nếu áp dụng)

**DoD:** Site chạy thật trên domain chính ✅ (đã đạt sớm hơn kế hoạch — xem ghi chú Phase 2.7), nhận thanh toán thật (cần chủ dự án xác nhận key production vs sandbox), có backup tự động ✅ (chưa thử restore — mục 4.4), giám sát hoạt động ❌ (chưa có Sentry/Uptime Kuma), rollback đã diễn tập (❌ chưa).

---

## Phase 5 — Hậu launch: vận hành & cải tiến liên tục
**Môi trường:** Production

- [ ] Theo dõi sát lỗi/giao dịch trong tuần đầu (daily check dashboard + Sentry)
- [ ] Backup: kiểm tra hàng ngày tự động chạy, restore thử lại hàng tuần
- [ ] Vá bảo mật OS/aaPanel hàng tháng, xoay vòng JWT secret / key R2/S3 định kỳ
- [ ] Thu thập feedback người dùng cũ từ v1 → backlog cải tiến
- [ ] Roadmap tính năng ngoài phạm vi ban đầu (không cam kết thời điểm): app di động, chương trình affiliate, gamification/huy hiệu, đa ngôn ngữ

---

## Phụ lục

- **Tài liệu chi tiết:** [`docs/khomanguon-v2-spec.html`](docs/khomanguon-v2-spec.html) — tech stack đầy đủ, sơ đồ kiến trúc, luồng nghiệp vụ (mermaid), ma trận RBAC, 25 use case, 12 wireframe, hướng dẫn deploy aaPanel từng bước.
- **Migration dữ liệu WordPress:** [`Migration_Plan.md`](Migration_Plan.md) — mapping bảng WP → v2, các quyết định kỹ thuật (mật khẩu, ảnh/file, ví `@CASH` cũ), quy trình dry-run → Staging → Production.
- **Nguyên tắc theo dõi:** cập nhật trực tiếp các checkbox `- [ ]` → `- [x]` trong file này khi hoàn thành; mỗi phase kết thúc bằng một buổi demo nội bộ trước khi mở khoá phase tiếp theo.
- **Mục 🔴 phụ thuộc bên ngoài** nên giao cho người phụ trách vận hành/kinh doanh làm song song, không chờ đến đúng phase mới bắt đầu — đặc biệt merchant SePay production có thể mất thời gian duyệt.
