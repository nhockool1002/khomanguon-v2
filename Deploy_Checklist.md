# Checklist deploy lần đầu — Frontend (Vercel) + Backend (aaPanel)

Đây là danh sách thao tác cụ thể theo đúng thứ tự để đưa Phase 1 (Auth/Profile/RBAC) lên production lần đầu, và cấu hình auto-deploy cho backend. Giải thích "vì sao" từng bước nằm ở [`docs/khomanguon-v2-spec.html`](docs/khomanguon-v2-spec.html) mục 11–13 — file này chỉ liệt kê **việc phải làm**.

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

Lưu 3 giá trị này lại — dùng ở bước 2. Không commit vào Git dưới bất kỳ hình thức nào.

---

## 2. Backend trên aaPanel (deploy thủ công lần đầu)

Bắt buộc làm thủ công 1 lần trước — auto-deploy ở mục 3 chỉ *cập nhật* container đã tồn tại, không tự tạo hạ tầng từ đầu.

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
   - `FRONTEND_URL` = `https://khomanguon.vn` (domain Vercel thật, đặt sau khi có ở bước 5 — có thể để tạm rồi sửa lại)
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

## 3. Cấu hình auto-deploy backend (GitHub Actions → SSH → aaPanel)

Sau bước này, mỗi lần push vào `main` và CI xanh, backend tự động `git pull` + rebuild container + chạy migration trên VPS — không cần thao tác tay.

**Đã làm sẵn cho bạn trong phiên này:**
- [x] Sinh cặp khoá SSH riêng cho GitHub Actions (không dùng chung khoá cá nhân của bạn)
- [x] Đã set secret `SSH_PRIVATE_KEY` vào repo GitHub (`gh secret set`) — private key không hiển thị lại được nữa, đã xoá khỏi máy ngay sau khi upload
- [x] Đã thêm job `deploy-backend` vào [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — chỉ chạy khi push vào `main` và job `backend` (lint/build/test) đã pass

**Việc bạn cần làm:**

1. **Tạo user deploy riêng trên VPS** (khuyến nghị, không dùng root — khoá bị lộ chỉ ảnh hưởng phạm vi giới hạn):
   ```bash
   adduser deploy
   usermod -aG docker deploy          # để chạy được lệnh docker compose
   chown -R deploy:deploy /www/wwwroot/khomanguon-v2
   mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
   ```
   *(Muốn đơn giản hơn thì dùng thẳng `root` — bỏ qua bước tạo user, dùng `SSH_USER=root` ở bước 3 bên dưới. Đánh đổi: khoá deploy lộ = mất toàn quyền VPS thay vì chỉ mất quyền thư mục này.)*

2. **Thêm public key sau vào `~/.ssh/authorized_keys`** của user vừa chọn (deploy hoặc root):
   ```
   ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBL0dQ0BlE5EVeqKhy9f6+lTNVSPVwZybbYhGq99QYH0 github-actions-deploy@khomanguon-v2
   ```
   ```bash
   echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBL0dQ0BlE5EVeqKhy9f6+lTNVSPVwZybbYhGq99QYH0 github-actions-deploy@khomanguon-v2" >> /home/deploy/.ssh/authorized_keys
   chmod 600 /home/deploy/.ssh/authorized_keys
   chown -R deploy:deploy /home/deploy/.ssh
   ```

3. **Cho tôi biết 3 giá trị sau** (hoặc tự set qua `gh secret set <TÊN> --repo nhockool1002/khomanguon-v2`), tôi sẽ set nốt secrets còn thiếu:
   - `SSH_HOST` — IP hoặc domain VPS
   - `SSH_USER` — `deploy` (hoặc `root` nếu chọn cách đơn giản)
   - `SSH_PORT` — thường `22`, trừ khi aaPanel đã đổi cổng SSH

4. **Test SSH thủ công trước khi tin tưởng CI** (từ máy bạn, dùng public key vừa thêm để xác nhận không bị hỏi password):
   ```bash
   ssh -o PasswordAuthentication=no deploy@<SSH_HOST> "cd /www/wwwroot/khomanguon-v2 && docker compose -f docker-compose.prod.yml ps"
   ```

5. **Kích hoạt lần đầu:** push bất kỳ thay đổi nào vào `main` (hoặc vào GitHub → Actions → chọn workflow CI → "Re-run jobs" trên lần chạy gần nhất) → theo dõi job `deploy-backend` trong tab Actions.

⚠️ Nếu SSH deploy lỗi, container backend **cũ vẫn tiếp tục chạy** (lệnh `up -d --build` chỉ thay thế container sau khi image mới build xong) — không tự rollback nếu migration mới bị lỗi giữa chừng, nên vẫn nên theo dõi log sau mỗi lần deploy quan trọng.

---

## 4. Frontend trên Vercel

1. Đăng nhập [vercel.com](https://vercel.com) bằng GitHub → **Add New → Project** → chọn `nhockool1002/khomanguon-v2`.
2. **Root Directory** → chọn `frontend`. Framework/package manager Vercel tự nhận diện, không cần sửa.
3. **Environment Variables** (áp dụng cho cả Production + Preview):
   ```
   NEXT_PUBLIC_API_URL=https://api.khomanguon.vn
   ```
4. Bấm **Deploy**.
5. **Gắn domain:** Project → Domains → thêm `khomanguon.vn` → làm theo bản ghi DNS Vercel yêu cầu (thường `A 76.76.21.21` hoặc `CNAME cname.vercel-dns.com`). Nếu domain đang ở Cloudflare, chuyển record này sang **DNS only** (mây xám) — không bật proxy Cloudflare song song với Vercel.

---

## 5. Khớp lại CORS/cookie giữa 2 domain

Sau khi có domain Vercel thật:

1. Sửa `FRONTEND_URL` trong `.env.production` trên aaPanel thành domain Vercel chính thức (`https://khomanguon.vn`).
2. Restart backend để áp dụng:
   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml restart backend
   ```
   *(Từ giờ về sau, thay đổi `.env.production` vẫn cần restart tay — auto-deploy ở mục 3 không tự đọc lại biến môi trường đã đổi, chỉ deploy code mới.)*

---

## 6. Smoke test sau khi deploy (bắt buộc, đừng bỏ qua)

- [ ] `https://api.khomanguon.vn/health` trả về `{"status":"ok","db":"up"}`
- [ ] Mở `https://khomanguon.vn` — trang chủ load được, navbar hiển thị đúng
- [ ] Đăng ký tài khoản thật qua UI (`/dang-ky`) — thành công, chuyển vào `/tai-khoan`
- [ ] **Reload trang `/tai-khoan`** — vẫn còn đăng nhập (xác nhận cookie cross-site + silent refresh hoạt động; đây là bước hay lỗi nhất khi tách domain)
- [ ] Đăng xuất rồi đăng nhập lại — thành công
- [ ] Kiểm tra log backend không có lỗi CORS: `docker compose -f docker-compose.prod.yml logs backend --tail=50`

Nếu bước "reload vẫn còn đăng nhập" thất bại → gần như chắc chắn do `FRONTEND_URL`/`ALLOWED_ORIGINS` chưa khớp domain Vercel thật, xem lại mục 5.

---

## 7. Muốn tôi hỗ trợ trực tiếp?

Tôi không có sẵn quyền truy cập Vercel/VPS của bạn nên không tự chạy được các bước cần SSH/UI. Nếu muốn tôi hỗ trợ trực tiếp:
- Chạy từng lệnh SSH ở mục 2/3 rồi dán output vào chat nếu gặp lỗi, tôi đọc và hướng dẫn tiếp theo thời gian thực.
- Hoặc mở terminal SSH vào VPS ngay trong phiên làm việc này (nếu công cụ của bạn hỗ trợ) để tôi chạy trực tiếp — cho tôi biết nếu muốn theo hướng này.
