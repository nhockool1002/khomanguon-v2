// Lưu trong SiteSetting.value (key = MEMBER_DIGEST_CONFIG_KEY) — cùng pattern key/value chung đã
// dùng cho newsletter_config/backup_config/sepay_config. Khác newsletter_config: có thêm `template`
// (1 mẫu duy nhất Admin tự biên tập {{var}}, không phải danh sách preset — xem mail-templates.types.ts
// renderMailTemplate() dùng chung cú pháp {{key}}).
export interface MemberDigestTemplate {
  subject: string;
  html: string;
}

export interface MemberDigestConfig {
  enabled: boolean;
  dayOfWeek: number; // 0-6 theo Date.getDay() (0 = Chủ nhật)
  hour: number; // 0-23, giờ local server
  minute: number; // 0-59
  lastSentAt: string | null; // ISO string — set ngay lúc TẠO batch (không đợi gửi xong), xem
  // member-digest.service.ts createBatchIfDue()
  template: MemberDigestTemplate;
}

export const MEMBER_DIGEST_CONFIG_KEY = 'member_digest_config';

const DEFAULT_TEMPLATE_HTML = `<p>Chào {{displayName}},</p>
<p>Điểm qua KHOMANGUON.ORG tuần này:</p>
{{newPostsHtml}}
{{mostViewedHtml}}
{{mostDownloadedHtml}}
<p style="margin-top:16px;font-size:12px;color:#a1a1aa;">
  Bạn nhận được email này vì là thành viên đã kích hoạt tài khoản tại khomanguon.org. Tắt nhận ở
  trang <a href="{{accountUrl}}" style="color:#a1a1aa;">Tài khoản</a> của bạn.
</p>`;

// Mặc định TẮT — cùng lý do DEFAULT_NEWSLETTER_CONFIG/DEFAULT_BACKUP_CONFIG: Admin phải chủ động
// bật sau khi xem lại nội dung template, tránh gửi hàng loạt ngoài ý muốn. Thứ Hai 9h sáng là mặc
// định hợp lý nếu bật lên ngay (khớp NewsletterConfig).
export const DEFAULT_MEMBER_DIGEST_CONFIG: MemberDigestConfig = {
  enabled: false,
  dayOfWeek: 1,
  hour: 9,
  minute: 0,
  lastSentAt: null,
  template: {
    subject: 'Bản tin thành viên KHOMANGUON.ORG — tuần này có gì mới?',
    html: DEFAULT_TEMPLATE_HTML,
  },
};
