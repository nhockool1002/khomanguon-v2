# Quy ước đóng góp

## Nhánh

- `main` luôn deploy được (CI phải xanh).
- Làm việc trên nhánh ngắn hạn đặt theo `<loai>/<mo-ta-ngan>`, ví dụ `feat/dang-nhap`, `fix/webhook-sepay-trung-lap`.
- Mở Pull Request vào `main`, merge sau khi CI pass + có review (nếu làm nhóm).
- Không push thẳng lên `main` khi có từ 2 người trở lên tham gia dự án.

## Commit message — Conventional Commits

```
<type>(<scope>): <mô tả ngắn, thì hiện tại>
```

Type thường dùng: `feat` (tính năng mới), `fix` (sửa lỗi), `refactor`, `chore`, `docs`, `test`, `ci`.

Ví dụ:

```
feat(auth): thêm API đăng ký + xác minh email
fix(wallet): chặn webhook SePay cộng tiền trùng khi gọi lại
docs(plan): cập nhật checklist Phase 2
```

## Code style

- Lint trước khi commit: `pnpm run lint` trong `frontend/` hoặc `backend/`.
- Build/typecheck phải sạch: `pnpm run build`.
- Không tắt rule ESLint bằng comment trừ khi thực sự cần — nếu tắt, phải có comment giải thích lý do.

## Trước khi mở PR

- [ ] `pnpm run lint` sạch
- [ ] `pnpm run build` sạch
- [ ] Test liên quan đã chạy qua (`pnpm run test`, và `pnpm run test:e2e` nếu đụng tới API)
- [ ] Không có secret/API key nào trong diff
- [ ] Nếu đổi `prisma/schema.prisma` → đã có migration đi kèm (`pnpm exec prisma migrate dev`)

## Theo dõi tiến độ

Tick trực tiếp checkbox trong [`PLAN.md`](PLAN.md) khi hoàn thành một đầu việc.
