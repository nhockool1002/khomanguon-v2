// Danh mục huy hiệu cố định — hardcode ở đây, seed vào bảng Badge (giống ALL_PERMISSION_KEYS ở
// roles/permissions.constant.ts). Chưa có admin UI tạo/sửa huy hiệu vì chưa có nhu cầu thay đổi
// thường xuyên; thêm huy hiệu mới chỉ cần thêm phần tử ở đây + nhánh điều kiện tương ứng trong
// badges.service.ts checkAndAward(), không cần migration cho phần dữ liệu (seed tự upsert).
export interface BadgeDefinition {
  slug: string;
  name: string;
  description: string;
  icon: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    slug: 'first-post',
    name: 'Cây bút mới',
    description: 'Xuất bản bài viết đầu tiên',
    icon: '📝',
  },
  {
    slug: 'prolific-writer',
    name: 'Ngòi bút sung sức',
    description: 'Xuất bản từ 10 bài viết trở lên',
    icon: '🖋️',
  },
  {
    slug: 'first-comment',
    name: 'Người mở lời',
    description: 'Đăng bình luận đầu tiên',
    icon: '💬',
  },
  {
    slug: 'century-commenter',
    name: 'Bình luận gia',
    description: 'Đăng từ 100 bình luận trở lên',
    icon: '🗨️',
  },
  {
    slug: 'veteran',
    name: 'Thành viên kỳ cựu',
    description: 'Đồng hành cùng cộng đồng từ 365 ngày trở lên',
    icon: '🎖️',
  },
  {
    slug: 'supporter',
    name: 'Nhà hảo tâm',
    description: 'Nạp tiền vào Ví $P thành công lần đầu',
    icon: '💎',
  },
];
