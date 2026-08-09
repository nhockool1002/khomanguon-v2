// Lưu trong SiteSetting.value (key = BACKUP_SETTING_KEY) — theo đúng pattern key/value chung đã
// dùng cho sepay_config/recaptcha_config. Không có gì nhạy cảm trong config này (chỉ giờ/số bản
// giữ lại/provider) nên không cần tách endpoint public/private như recaptcha.
export interface BackupConfig {
  enabled: boolean;
  hour: number; // 0-23, giờ local server chạy backend (không phải UTC)
  minute: number; // 0-59
  retentionCount: number; // giữ N bản SUCCESS gần nhất, xoá cũ hơn (cả object bucket lẫn record)
  storageProviderId: string | null;
}

export const BACKUP_SETTING_KEY = 'backup_config';

// Prefix key file backup trong bucket (db-backup.service.ts runBackup()) — export riêng để
// cloud-files.service.ts lọc bỏ khỏi trang "Quản lý File Cloud" (đó là trang xem file NGƯỜI DÙNG
// tải, không phải nơi quản lý backup hệ thống — đã có trang riêng Cài đặt > Backup DB).
export const BACKUP_OBJECT_KEY_PREFIX = 'backups/';

// Mặc định TẮT — Admin phải chủ động bật + chọn provider, tránh chạy pg_dump ngoài ý muốn khi
// chưa cấu hình xong (khác các feature khác trong dự án luôn bật sẵn).
export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  enabled: false,
  hour: 3,
  minute: 0,
  retentionCount: 7,
  storageProviderId: null,
};
