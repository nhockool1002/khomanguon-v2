// Lưu trong SiteSetting.value (key = NEWSLETTER_CONFIG_KEY) — cùng pattern key/value chung đã dùng
// cho backup_config/sepay_config. lastSentAt lưu ngay trong config (thay vì bảng log riêng) vì chỉ
// cần biết "đã gửi trong tuần này chưa", không cần giữ lịch sử từng lần gửi.
export interface NewsletterConfig {
  enabled: boolean;
  dayOfWeek: number; // 0-6 theo Date.getDay() (0 = Chủ nhật)
  hour: number; // 0-23, giờ local server
  minute: number; // 0-59
  lastSentAt: string | null; // ISO string
}

export const NEWSLETTER_CONFIG_KEY = 'newsletter_config';

// Mặc định TẮT — cùng lý do DEFAULT_BACKUP_CONFIG: Admin phải chủ động bật, tránh gửi mail hàng
// loạt ngoài ý muốn khi chưa cấu hình xong. Thứ Hai 9h sáng là mặc định hợp lý nếu bật lên ngay.
export const DEFAULT_NEWSLETTER_CONFIG: NewsletterConfig = {
  enabled: false,
  dayOfWeek: 1,
  hour: 9,
  minute: 0,
  lastSentAt: null,
};
