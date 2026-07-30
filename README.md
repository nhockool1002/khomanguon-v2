# khomanguon v2

Rebuild của [khomanguon.org](https://khomanguon.org) — kho chia sẻ mã nguồn Game/Web/App — với tài khoản người dùng, phân quyền theo vai trò (RBAC), CMS chuẩn SEO, và hệ thống tải game trả phí bằng ví nội bộ `$P` (nạp qua SePay).

- **Kế hoạch triển khai theo phase:** [`PLAN.md`](PLAN.md)
- **Đặc tả kỹ thuật đầy đủ** (tech stack, kiến trúc, RBAC, use case, wireframe 12 trang, hướng dẫn deploy aaPanel): [`docs/khomanguon-v2-spec.html`](docs/khomanguon-v2-spec.html)
- **Migration dữ liệu từ WordPress v1:** [`Migration_Plan.md`](Migration_Plan.md)

## Cấu trúc repo

```
frontend/   Next.js 16 (App Router, TypeScript, Tailwind) — giao diện public + admin
backend/    NestJS + Prisma (PostgreSQL) — API, auth, RBAC, ví $P, presigned URL
docs/       Tài liệu thiết kế
PLAN.md     Checklist triển khai theo phase
```

## Chạy local (dev)

Yêu cầu: Docker Desktop, Node 22, pnpm 9.

```bash
docker compose up
```

Lệnh trên khởi động Postgres, Redis, backend (`:4000`, hot reload) và frontend (`:3000`, hot reload) cùng lúc. Lần chạy đầu sẽ cài dependency bên trong container nên hơi lâu — các lần sau nhanh hơn nhờ volume cache.

- Frontend: http://localhost:3000
- Backend health check: http://localhost:4000/health

### Chạy riêng từng phần (không qua Docker cho app, chỉ dùng Docker cho DB)

```bash
docker compose up -d postgres redis   # chỉ hạ tầng
cd backend && cp .env.example .env && pnpm install && pnpm exec prisma migrate dev && pnpm run start:dev
cd frontend && cp .env.example .env && pnpm install && pnpm run dev
```

## Database

Schema định nghĩa tại [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). Sau khi sửa schema:

```bash
cd backend
pnpm exec prisma migrate dev --name <mo-ta-thay-doi>
```

## Deploy

Frontend deploy trên **Vercel** (root directory `frontend/`), backend deploy trên **aaPanel** (`docker-compose.prod.yml`, chỉ postgres/redis/backend). Vì 2 domain khác nhau, backend cần đúng `ALLOWED_ORIGINS`/`FRONTEND_URL` để CORS và cookie refresh token hoạt động.

- **Checklist thao tác cụ thể (làm theo thứ tự để deploy lần đầu):** [`Deploy_Checklist.md`](Deploy_Checklist.md)
- **Tài liệu tham khảo đầy đủ** (vì sao, giải thích từng lựa chọn): mục 11–13 trong [`docs/khomanguon-v2-spec.html`](docs/khomanguon-v2-spec.html)

## Bảo mật

- Không commit bất kỳ file `.env` thật nào — chỉ commit `.env.example`.
- Key R2/S3/SePay được cấu hình qua trang Admin lúc chạy (Phase 3), không hard-code trong repo.
