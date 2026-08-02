import { DEFAULT_ROLES } from '../roles/permissions.constant';

// Loại user có role Admin khỏi thống kê "member đã tải"/doanh thu — lượt Admin tự tải để test/duyệt
// nội dung không phải khách hàng thật, không nên tính vào số liệu công khai hay doanh thu.
// Dùng trực tiếp làm 1 nhánh AND trong where của findMany/groupBy trên bảng có quan hệ `user`.
export const EXCLUDE_ADMIN_USER_WHERE = {
  user: {
    roles: {
      none: { role: { slug: DEFAULT_ROLES.ADMIN.slug } },
    },
  },
};
