# Checklist deploy lần đầu — Frontend (Vercel) + Backend (aaPanel)

Đây là danh sách thao tác cụ thể theo đúng thứ tự để đưa Phase 1 (Auth/Profile/RBAC) lên production lần đầu. Giải thích "vì sao" từng bước nằm ở [`docs/khomanguon-v2-spec.html`](docs/khomanguon-v2-spec.html) mục 11–13 — file này chỉ liệt kê **việc phải làm**.

> Chưa cần R2/S3/SePay ở bước này — Phase 1 không đụng tới ví/link tải, phần đó cấu hình qua trang Admin ở Phase 3.

---

## 0. Chuẩn bị (làm trước, không phụ thuộc thứ tự)

- [ ] Domain đã mua, có quyền chỉnh bản ghi DNS (Cloudflare/nhà đăng ký khác)
- [ ] VPS aaPanel đã có sẵn (theo bạn xác nhận), có SSH root
- [ ] Tài khoản Vercel — đăng ký free tại vercel.com bằng GitHub nếu chưa có
- [ ] Quyết định 2 domain con: ví dụ `khomanguon.vn` (frontend) và `api.khomanguon.vn` (backend) — dùng đúng 2 tên này trong các bước dưới, đổi lại nếu bạn muốn tên khác

---

## 1. Sinh secrets production

Chạy trên máy bất kỳ có `openssl` (hoặc dùng bản đã sinh sẵn tôi đưa trong chat — dùng luôn, không cần chạy lại):

```bash
openssl rand -hex 32   # JWT_ACCESS_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
openssl rand -base64 24 | tr -d '=+/'   # POSTGRES_PASSWORD
```

Lưu 3 giá trị này lại — dùng ở bước 3. Không commit vào Git dưới bất kỳ hình thức nào.

---

## 2. Backend trên aaPanel

1. **SSH vào VPS**, cài Docker Manager nếu chưa có: aaPanel → **App Store → Docker Manager** → Install.
2. **Clone code:**
   ```bash
   cd /www/wwwroot
   git clone https://github.com/nhockool1002/khomanguon-v2.git
   cd khomanguon-v2
   ```
3. **Tạo `.env.production`** ở gốc repo (`/www/wwwroot/khomanguon-v2/.env.production`), nội dung dựa theo [`.env.production.example`](.env.production.example), điền:
   - `POSTGRES_PASSWORD` = giá trị sinh ở bước 1
   - `DATABASE_URL` = `postgresql://khomanguon:<POSTGRES_PASSWORD>@postgres:5432/khomanguon?schema=public`
   - `FRONTEND_URL` = `https://khomanguon.vn` (domain Vercel thật, đặt sau khi có ở bước 4 — có thể để tạm rồi sửa lại)
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` = giá trị sinh ở bước 1
   - `NODE_ENV=production`
   
   ```bash
   chmod 600 .env.production
   ```
4. **Deploy container:** trong aaPanel → app Docker → **Compose → Add**, trỏ tới `docker-compose.prod.yml` ở gốc repo → chạy. File này build image từ `backend/Dockerfile` và khởi động `postgres`, `redis`, `backend` (backend bind `127.0.0.1:4000`, không lộ ra ngoài).
5. **Chạy migration + seed** (lần đầu, tạo bảng + 4 role mặc định):
   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml exec backend pnpm exec prisma migrate deploy
   docker compose --env-file .env.production -f docker-compose.prod.yml exec backend pnpm exec prisma db seed
   ```
6. **Tạo site** trong aaPanel: **Website → Add site** → domain `api.khomanguon.vn` (không cần PHP).
7. **Reverse Proxy** cho site vừa tạo:
   ```nginx
   location / {
       proxy_pass http://127.0.0.1:4000/;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
   }
   ```
8. **Bật SSL:** tab SSL của site → Let's Encrypt → Apply → bật Force HTTPS.
9. **DNS:** thêm bản ghi `A` cho `api.khomanguon.vn` trỏ về IP VPS. Nếu quản lý DNS ở Cloudflare, có thể bật proxy (mây cam) cho riêng subdomain này.
10. **Khoá firewall:** aaPanel → Security — chỉ mở 80/443 + cổng panel đã đổi.
11. **Test nhanh** (từ máy bất kỳ):
    ```bash
    curl https://api.khomanguon.vn/health
    # kỳ vọng: {"status":"ok","db":"up"}
    ```

---

## 3. Frontend trên Vercel

1. Đăng nhập [vercel.com](https://vercel.com) bằng GitHub → **Add New → Project** → chọn `nhockool1002/khomanguon-v2`.
2. **Root Directory** → chọn `frontend`. Framework/package manager Vercel tự nhận diện, không cần sửa.
3. **Environment Variables** (áp dụng cho cả Production + Preview):
   ```
   NEXT_PUBLIC_API_URL=https://api.khomanguon.vn
   ```
4. Bấm **Deploy**.
5. **Gắn domain:** Project → Domains → thêm `khomanguon.vn` → làm theo bản ghi DNS Vercel yêu cầu (thường `A 76.76.21.21` hoặc `CNAME cname.vercel-dns.com`). Nếu domain đang ở Cloudflare, chuyển record này sang **DNS only** (mây xám) — không bật proxy Cloudflare song song với Vercel.

---

## 4. Khớp lại CORS/cookie giữa 2 domain

Sau khi có domain Vercel thật:

1. Sửa `FRONTEND_URL` trong `.env.production` trên aaPanel thành domain Vercel chính thức (`https://khomanguon.vn`).
2. Restart backend để áp dụng:
   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml restart backend
   ```

---

## 5. Smoke test sau khi deploy (bắt buộc, đừng bỏ qua)

- [ ] `https://api.khomanguon.vn/health` trả về `{"status":"ok","db":"up"}`
- [ ] Mở `https://khomanguon.vn` — trang chủ load được, navbar hiển thị đúng
- [ ] Đăng ký tài khoản thật qua UI (`/dang-ky`) — thành công, chuyển vào `/tai-khoan`
- [ ] **Reload trang `/tai-khoan`** — vẫn còn đăng nhập (xác nhận cookie cross-site + silent refresh hoạt động; đây là bước hay lỗi nhất khi tách domain)
- [ ] Đăng xuất rồi đăng nhập lại — thành công
- [ ] Kiểm tra log backend không có lỗi CORS: `docker compose -f docker-compose.prod.yml logs backend --tail=50`

Nếu bước "reload vẫn còn đăng nhập" thất bại → gần như chắc chắn do `FRONTEND_URL`/`ALLOWED_ORIGINS` chưa khớp domain Vercel thật, xem lại bước 4.

---

## 6. Muốn tôi hỗ trợ trực tiếp?

Tôi không có sẵn quyền truy cập Vercel/VPS của bạn nên không tự chạy được các bước trên. Nếu muốn tôi hỗ trợ trực tiếp:
- Chạy từng lệnh SSH ở mục 2 rồi dán output vào chat nếu gặp lỗi, tôi đọc và hướng dẫn tiếp theo thời gian thực.
- Hoặc mở terminal SSH vào VPS ngay trong phiên làm việc này (nếu công cụ của bạn hỗ trợ) để tôi chạy trực tiếp — cho tôi biết nếu muốn theo hướng này.
