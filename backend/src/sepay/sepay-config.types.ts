export interface TopupPreset {
  vnd: number;
  p: number;
}

// Lưu trong SiteSetting.value (key = SEPAY_SETTING_KEY) — không có model riêng, theo đúng thiết kế
// "R2/S3, SePay cấu hình qua trang Admin" đã ghi trong .env.example (key/value chung, xem UC15/UC21).
export interface SepayConfig {
  bankAccountNumber: string;
  bankName: string;
  accountHolderName: string;
  webhookApiKeyEncrypted: string | null;
  // Token "API Access" của SePay (my.sepay.vn/testmode/companyapi hoặc /companyapi) — chỉ dùng để
  // tự kiểm tra kết nối tới API của SePay (UC: nút "Thử kết nối API"), KHÔNG dùng cho webhook.
  apiAccessTokenEncrypted: string | null;
  baseRateVndPerP: number;
  presets: TopupPreset[];
}

// Trả về FE — không bao giờ chứa các trường *Encrypted, thay bằng cờ boolean.
export interface SepayConfigPublic {
  bankAccountNumber: string;
  bankName: string;
  accountHolderName: string;
  hasApiKey: boolean;
  hasApiAccessToken: boolean;
  baseRateVndPerP: number;
  presets: TopupPreset[];
}

export const SEPAY_SETTING_KEY = 'sepay_config';
export const SEPAY_SECRET_CONTEXT = 'khomanguon-sepay-config';

export const DEFAULT_SEPAY_CONFIG: SepayConfig = {
  bankAccountNumber: '',
  bankName: '',
  accountHolderName: '',
  webhookApiKeyEncrypted: null,
  apiAccessTokenEncrypted: null,
  baseRateVndPerP: 100, // mặc định 100đ = 1 $P, admin chỉnh lại theo thực tế trước khi dùng thật
  presets: [],
};
