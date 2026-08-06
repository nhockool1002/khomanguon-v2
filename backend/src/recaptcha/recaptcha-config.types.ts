// Lưu trong SiteSetting.value (key = RECAPTCHA_SETTING_KEY) — TÁCH RIÊNG khỏi GeneralSettings dù
// cùng chỉnh ở trang /admin/settings/general, vì GET /settings/general là endpoint CÔNG KHAI (trang
// chủ cần đọc banner) — không được lẫn secretKeyEncrypted vào đó. siteKey vốn public theo thiết kế
// của Google (luôn lộ trong HTML mọi trang có reCAPTCHA) nên an toàn trả qua endpoint công khai riêng.
export interface RecaptchaConfig {
  enabled: boolean;
  siteKey: string;
  secretKeyEncrypted: string | null;
}

export interface RecaptchaConfigPublic {
  enabled: boolean;
  siteKey: string;
}

// Trả về trang Admin — không bao giờ chứa secretKeyEncrypted, thay bằng cờ boolean (giống
// SepayConfigPublic.hasApiKey).
export interface RecaptchaAdminConfig {
  enabled: boolean;
  siteKey: string;
  hasSecretKey: boolean;
}

export const RECAPTCHA_SETTING_KEY = 'recaptcha_config';
export const RECAPTCHA_SECRET_CONTEXT = 'khomanguon-recaptcha';

export const DEFAULT_RECAPTCHA_CONFIG: RecaptchaConfig = {
  enabled: false,
  siteKey: '',
  secretKeyEncrypted: null,
};
