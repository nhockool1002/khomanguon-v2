// Mirror rút gọn của backend/src/roles/permissions.constant.ts — chỉ khai báo key thực sự cần
// kiểm tra ở client (ẩn/hiện thao tác quản trị), không phải bản sao đầy đủ ma trận RBAC.
export const PERMISSIONS = {
  CACHE_MANAGE: "cache.manage",
} as const;
