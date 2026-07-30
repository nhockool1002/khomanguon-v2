# KHOMANGUON v2 — Kế hoạch triển khai

> Tài liệu thiết kế đầy đủ (tech stack, kiến trúc, RBAC, use case, wireframe 12 trang, hướng dẫn deploy aaPanel): [`docs/khomanguon-v2-spec.html`](docs/khomanguon-v2-spec.html)

Quy ước: mỗi phase có **Definition of Done (DoD)** rõ ràng — không sang phase tiếp theo khi DoD chưa đạt. Item đánh dấu 🔴 là phụ thuộc bên ngoài (không chỉ code) nên cần khởi động sớm, chạy song song với các phase code.

**Môi trường theo từng giai đoạn:** Phase 0–3 chạy trên **Local (Docker Compose)**; cuối Phase 3 lần đầu đẩy lên **Staging (aaPanel VPS nhỏ)**; Phase 4 chuyển dần sang **Production (aaPanel VPS chính + Cloudflare)**.

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

## Phase 0 — Chuẩn bị & khởi tạo dự án
**Thời lượng:** 1 tuần · **Môi trường:** Local

- [x] Khởi tạo repo tại [github.com/nhockool1002/khomanguon-v2](https://github.com/nhockool1002/khomanguon-v2) — `frontend/` (Next.js 16) + `backend/` (NestJS + Prisma), chưa dùng workspace `packages/` dùng chung vì 2 app chưa cần share code
- [x] Quy ước code: ESLint (frontend + backend), Prettier (backend) sạch; commit convention (Conventional Commits) + branch strategy trunk-based trong [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [x] Docker Compose dev: `postgres`, `redis`, `backend` (`:4000`, hot reload), `frontend` (`:3000`, hot reload) — `docker compose up` một lệnh, đã build & chạy thử thành công
- [x] ERD chi tiết — thể hiện trực tiếp trong [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma) (users, roles, permissions, role_permissions, posts, categories, menus, comments, wallets, wallet_transactions, download_links, download_grants, storage_providers, site_settings)
- [x] Khởi tạo Prisma schema + migration đầu tiên (`prisma migrate dev --name init`) — đã áp dụng, tạo 20 bảng trên Postgres dev
- [x] CI skeleton (`.github/workflows/ci.yml`): lint + build + unit test + e2e test (kèm Postgres service) cho backend, lint + build cho frontend — chạy trên mọi PR/push `main`
- [ ] 🔴 Đăng ký tài khoản dịch vụ ngoài: Cloudflare R2 + AWS S3 (đã có sẵn từ v1, cần trang Admin ở Phase 3 để nhập lại key), SePay (đăng ký merchant + xin sandbox key — đang tiến hành), Sentry, domain
- [x] 🔴 VPS + aaPanel cho Staging/Production đã có sẵn (xác nhận từ chủ dự án)

**DoD:** `docker compose up` chạy được ✅, CI xanh trên PR rỗng ✅ (đã chạy tương đương local), schema/migration khớp ERD ✅, còn thiếu: sandbox key SePay + nhập lại key R2/S3 vào trang Admin (việc của Phase 3, không chặn Phase 1).

---

## Phase 1 — Nền tảng: Auth, Profile, RBAC cơ bản, CMS core
**Thời lượng:** 4–6 tuần · **Môi trường:** Local

### 1.1 Auth & bảo mật tài khoản
- [x] API đăng ký (email + mật khẩu, hash Argon2) + email xác minh (token hash SHA-256, hết hạn 24h, one-time use)
- [x] API đăng nhập (JWT access 15p + refresh 30 ngày xoay vòng, cookie httpOnly `path=/auth`), khoá tạm 15 phút sau 5 lần sai — UC01, UC02
- [x] API quên/đặt lại mật khẩu (token hết hạn 15 phút, one-time use, đổi xong thu hồi hết refresh token) — UC03
- [x] UI Đăng nhập (`/dang-nhap`), Đăng ký (`/dang-ky`), Quên mật khẩu (`/quen-mat-khau`), Đặt lại mật khẩu (`/dat-lai-mat-khau`), Xác minh email (`/xac-minh-email`) — theo wireframe #04/#05, đã test qua trình duyệt thật

### 1.2 Hồ sơ người dùng
- [x] API `GET/PATCH /users/me`, `PATCH /users/me/password` (đổi mật khẩu thu hồi hết session), `POST /auth/resend-verification` — UC04
- [x] UI trang `/tai-khoan` với tab Thông tin (tên hiển thị, bio, badge vai trò, banner + nút gửi lại email xác minh) và Bảo mật (đổi mật khẩu) — theo wireframe #06, đã test qua trình duyệt thật. Avatar upload thật (ảnh file) để dành Phase 3 khi có R2/S3 — hiện chỉ nhận `avatarUrl` dạng URL.

### 1.3 RBAC cơ bản
- [x] Bảng `roles`, `permissions`, `role_permissions`, `user_roles`; seed 18 permission + 4 role mặc định (Admin/Super Mod/Mod/Member) đúng ma trận quyền mục 06 tài liệu thiết kế (`prisma/seed.ts`)
- [x] `PermissionsGuard` + `@Permissions(...)` kiểm tra theo mã quyền (không hard-code theo tên role) — đã test 403 đúng khi member gọi endpoint cần `user.manage`
- [x] `GET /users` (list, cần `user.manage`), `POST/DELETE /users/:id/roles` (gán/gỡ role, cần `user.assign_role`) — UC18, đã test admin gán role thành công + member bị chặn

### 1.4 CMS bài viết (khung cơ bản)
- [ ] Model Post, Category (chưa có Tag/SEO nâng cao)
- [ ] API CRUD bài viết (chưa có WYSIWYG, chỉ textarea tạm)
- [ ] UI trang chủ (wireframe #01), trang danh mục (wireframe #02), chi tiết bài viết (wireframe #03) — bản khung, chưa có link tải/bình luận
- [ ] Layout public bám bản sắc v1 (navbar tối, thẻ bài viết, gạch chân gradient — mục 02 tài liệu thiết kế)

### 1.5 Kiểm thử
- [ ] Test unit cho Auth (đăng ký/đăng nhập/reset mật khẩu) — luồng trọng yếu, ưu tiên coverage cao

**DoD:** User đăng ký/đăng nhập/sửa hồ sơ được; Admin đăng nhập thấy danh sách bài viết; phân quyền cơ bản chặn đúng theo role.

---

## Phase 2 — Nội dung & điều hướng
**Thời lượng:** 3–4 tuần · **Môi trường:** Local → Staging (deploy thử lần đầu cuối phase)

### 2.1 Soạn thảo & SEO bài viết
- [ ] Tích hợp Tiptap (WYSIWYG) + upload ảnh trong nội dung
- [ ] Upload thumbnail/ảnh đại diện bài viết
- [ ] Panel SEO: meta title/description có đếm ký tự, slug, ảnh OG, xem trước snippet Google — UC14, wireframe #09
- [ ] Workflow trạng thái bài viết: Nháp → Chờ duyệt → Xuất bản, quyền `post.publish` — UC12, UC13

### 2.2 Menu đa cấp
- [ ] Model menu dạng cây (adjacency list: `parent_id`, `order`)
- [ ] API CRUD + đổi thứ tự/cấp độ
- [ ] UI kéo-thả bằng dnd-kit, gán hiển thị theo vai trò — UC16, wireframe #10

### 2.3 Bình luận
- [ ] Model comment (threaded — `parent_id`), API tạo/trả lời/thích
- [ ] UI bình luận trên trang chi tiết bài viết — UC07, wireframe #03
- [ ] Chức năng kiểm duyệt (ẩn/xoá/ghim, chặn user spam) cho Moderator — UC08

### 2.4 Tìm kiếm & danh mục
- [ ] Tìm kiếm full-text (Postgres `tsvector` hoặc Meilisearch nếu traffic lớn) — UC05
- [ ] Lọc theo danh mục/tag, sắp xếp mới nhất/phổ biến — wireframe #02

### 2.5 Custom Role đầy đủ
- [ ] UI ma trận quyền tick chọn theo module (tạo custom role) — UC17, wireframe #11

### 2.6 SEO toàn site
- [ ] Sinh `sitemap.xml` tự động khi publish, `robots.txt`
- [ ] Xác minh Google Search Console, gắn mã Analytics — UC15

### 2.7 Deploy thử Staging
- [ ] Chuẩn bị VPS staging trên aaPanel (Docker Manager, site, SSL) — theo mục 12 tài liệu, Cách A
- [ ] Deploy bản build đầu tiên lên staging, review nội bộ

**DoD:** Mod đăng bài đầy đủ SEO, Admin duyệt bài, menu kéo-thả hoạt động đúng thứ tự, user bình luận/kiểm duyệt được, custom role tạo được từ UI, bản staging chạy được qua domain phụ.

---

## Phase 3 — Kinh tế nội bộ: Ví $P, SePay, Download trả phí
**Thời lượng:** 4–5 tuần · **Môi trường:** Staging (không test trên production)

> Phase nhạy cảm nhất — mọi thao tác trừ/cộng tiền phải nằm trong 1 DB transaction, có test E2E riêng.

### 3.1 Ví $P
- [ ] Model `wallets`, `wallet_transactions` (ACID)
- [ ] UI trang Ví & lịch sử giao dịch — UC10, wireframe #07

### 3.2 Nạp tiền qua SePay
- [ ] API tạo yêu cầu nạp tiền + sinh mã QR VietQR (trạng thái `pending`)
- [ ] Webhook nhận xác nhận từ SePay: xác thực chữ ký HMAC, chống gọi trùng (unique theo mã giao dịch) — UC09, UC23
- [ ] Đẩy realtime số dư mới qua WebSocket sau khi webhook xử lý xong
- [ ] Cron huỷ giao dịch `pending` quá hạn (30 phút)

### 3.3 Link tải & giá $P
- [ ] Model `download_links` (gắn Post, provider R2/S3, object key, giá $P)
- [ ] UI quản lý link tải trong trình soạn bài (nhiều link/bài, mỗi link 1 giá) — wireframe #09
- [ ] API mua + sinh presigned URL: kiểm tra số dư → trừ tiền (1 transaction) → gọi SDK R2/S3 → TTL 5–15 phút — UC11, UC24
- [ ] Model `download_grants` cho phép tải lại miễn phí trong X ngày sau khi đã mua (tránh thu tiền 2 lần vô lý)

### 3.4 Cài đặt hệ thống liên quan
- [ ] Trang cài đặt Key R2/S3 (nhiều provider, nút test kết nối, chọn mặc định) — UC20, wireframe #12
- [ ] Trang cài đặt SePay (API key, webhook secret) + tỉ giá VNĐ↔$P, gói nạp khuyến mãi — UC21

### 3.5 Chống lạm dụng
- [ ] Rate limit lượt tải/IP, log IP mỗi lần tải
- [ ] Chức năng báo lỗi link die → hàng chờ xử lý của Moderator — UC25

### 3.6 Kiểm thử bắt buộc
- [ ] Test E2E (Playwright) luồng nạp tiền: tạo yêu cầu → webhook giả lập → số dư cập nhật đúng
- [ ] Test E2E luồng tải file: đủ/không đủ số dư, trừ đúng 1 lần dù bấm nhiều lần (idempotency)
- [ ] Test webhook bị gọi lại (replay) không cộng tiền 2 lần

**DoD:** Nạp tiền qua SePay sandbox thành công và cộng đúng $P; mua link tải trừ đúng tiền, tải được file qua presigned URL còn hạn; webhook gọi trùng không gây cộng/trừ tiền sai.

---

## Phase 4 — Tối ưu, bảo mật & Go-live
**Thời lượng:** 2–3 tuần · **Môi trường:** Staging → Production

### 4.1 Dashboard quản trị
- [ ] Thống kê doanh thu, user mới, bài viết chờ duyệt, lượt tải — UC22, wireframe #08

### 4.2 Tối ưu tốc độ (theo mục 09 tài liệu thiết kế)
- [ ] SSR/ISR cho trang bài viết/danh mục, revalidate khi publish
- [ ] Cache Cloudflare Edge cho trang public + asset tĩnh
- [ ] Redis cache cho query nóng (bài mới, đếm lượt tải)
- [ ] Pipeline ảnh: resize + WebP/AVIF khi upload, lazy-load
- [ ] Giảm JS client: tối đa hoá React Server Components

### 4.3 Bảo mật
- [ ] Rà soát OWASP Top 10 (đặc biệt XSS trong output WYSIWYG, CSRF, injection)
- [ ] Rate limit toàn bộ API công khai (đăng nhập, tìm kiếm, tải)
- [ ] Audit log cho thao tác nhạy cảm: đổi quyền, điều chỉnh ví thủ công, đổi key R2/S3

### 4.4 Hạ tầng Production
- [ ] Setup aaPanel Production theo mục 12 tài liệu (Cách A: Docker Compose) — cài panel, khoá 2FA, Docker Manager, reverse proxy, SSL, Cloudflare, firewall, cron
- [ ] CI/CD: GitHub Actions build/test → image lên GHCR → deploy staging tự động → deploy production cần duyệt thủ công (mục 11 tài liệu)
- [ ] Backup PostgreSQL tự động hàng ngày + đã thử restore ít nhất 1 lần
- [ ] Giám sát: Sentry (lỗi), Uptime Kuma (uptime), theo dõi tài nguyên aaPanel

### 4.5 Dữ liệu & nội dung
- [ ] 🔴 Migrate dữ liệu từ WordPress v1 sang v2 — kế hoạch chi tiết, mapping bảng, các quyết định kỹ thuật (mật khẩu, ảnh/file, ví `@CASH` cũ, comment khách...) nằm ở [`Migration_Plan.md`](Migration_Plan.md). Đang chờ file SQL export đầy đủ từ WordPress — khâu khảo sát/viết script ETL có thể bắt đầu ngay khi có SQL, **không cần chờ tới Phase 4**, chỉ việc chạy thật lên Production mới nên để sát Go-live.
- [ ] 🔴 Soạn điều khoản sử dụng, chính sách hoàn tiền $P, chính sách bản quyền mã nguồn chia sẻ

### 4.6 Go-live (checklist đầy đủ ở mục 13 tài liệu)
- [ ] DNS + SSL production hoạt động, force HTTPS
- [ ] Chuyển toàn bộ key sandbox → key production (SePay, R2/S3), xoá key dev khỏi `.env`
- [ ] Test nạp tiền thật với số tiền nhỏ trên production
- [ ] Test tải file thật trên bucket production
- [ ] Rollback plan sẵn sàng (giữ image tag bản trước)
- [ ] 🔴 Thông báo người dùng v1 về thời điểm chuyển đổi (nếu áp dụng)

**DoD:** Site chạy thật trên domain chính, nhận thanh toán thật, có backup + giám sát hoạt động, rollback đã diễn tập.

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
