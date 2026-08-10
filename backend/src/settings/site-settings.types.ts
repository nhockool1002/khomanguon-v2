export type HeaderBackgroundSize = 'cover' | 'contain' | 'auto';
export type HeaderBackgroundAttachment = 'scroll' | 'fixed';

// Rate limit API công khai — không nhạy cảm (ai cũng đoán được "login tối đa X lần") nên đặt chung
// GeneralSettings dù endpoint public, khác reCAPTCHA secret key phải tách riêng (xem recaptcha/).
export interface RateLimitRule {
  windowSec: number;
  max: number;
}

export interface RateLimitSettings {
  enabled: boolean;
  login: RateLimitRule;
  register: RateLimitRule;
  forgotPassword: RateLimitRule;
  resetPassword: RateLimitRule;
  search: RateLimitRule;
  commentCreate: RateLimitRule;
  feedbackCreate: RateLimitRule;
  newsletterSubscribe: RateLimitRule;
}

// Chế độ Bảo trì (bổ sung 2026-08-10) — bật thì FE (maintenance-gate.tsx) chặn toàn site, chỉ hiện
// trang bảo trì với message này cho user KHÔNG có quyền PERMISSIONS.MAINTENANCE_BYPASS (gán qua
// trang Quản lý Permission như mọi quyền khác — không có danh sách roleSlugs riêng ở đây, tái dùng
// thẳng RBAC sẵn có). Admin luôn có quyền này qua ALL_PERMISSION_KEYS nên không cần cờ riêng.
// Không có field ảnh — trang bảo trì dùng hình minh hoạ dựng sẵn (maintenance-page.tsx), không phải
// ảnh upload được.
export interface MaintenanceModeSettings {
  enabled: boolean;
  message: string;
}

// Lưu trong SiteSetting.value (key = GENERAL_SETTINGS_KEY) — không có model riêng, theo đúng
// pattern key/value chung đã dùng cho sepay_config (xem sepay/sepay-config.types.ts).
export interface GeneralSettings {
  postsPerPage: number;
  // Title thẻ <title> trình duyệt/SEO toàn site (layout.tsx generateMetadata) — khác headerTitle
  // bên dưới (chỉ là dòng chữ nhỏ trong banner trang chủ, xem SiteHero).
  siteTitle: string;
  headerTitle: string;
  headerSlogan: string;
  headerBackgroundColor: string;
  headerBackgroundImageUrl: string | null;
  headerBackgroundSize: HeaderBackgroundSize;
  headerBackgroundAttachment: HeaderBackgroundAttachment;
  // % vị trí ảnh nền (0 = trái/trên, 100 = phải/dưới) — cho phép "kéo" ảnh tới vị trí tuỳ ý.
  headerBackgroundPositionX: number;
  headerBackgroundPositionY: number;
  // Chiều cao tối thiểu khối banner (px) — nội dung ít vẫn giữ đủ cao, nội dung dài hơn thì banner
  // tự giãn theo (dùng min-height, không phải height cố định).
  headerMinHeight: number;
  // Style chữ khối banner — fontFamily là key trong FONT_OPTIONS (frontend/src/lib/fonts.ts, đã
  // dùng cho role badge), null = dùng font mặc định của site (Arial).
  headerTitleColor: string;
  headerTitleFontFamily: string | null;
  headerTitleBold: boolean;
  headerSloganColor: string;
  headerSloganFontFamily: string | null;
  headerSloganBold: boolean;
  headerSloganItalic: boolean;
  // PLAN.md 2.6 (SEO toàn site) — để trống thì không render thẻ/script tương ứng.
  gaTrackingId: string; // "G-XXXXXXX" — gắn gtag.js vào layout.tsx
  googleSiteVerification: string; // nội dung thẻ <meta name="google-site-verification">
  // Text chân trang toàn site (footer.tsx) — Admin tự đổi ở Cài đặt chung.
  footerText: string;
  rateLimits: RateLimitSettings;
  maintenanceMode: MaintenanceModeSettings;
}

export const GENERAL_SETTINGS_KEY = 'general_settings';

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  postsPerPage: 9,
  siteTitle: 'khomanguon — Mở kho, dựng lại thanh xuân',
  headerTitle: 'khomanguon.vn',
  headerSlogan:
    'Mở kho, dựng lại thanh xuân — kho mã nguồn Game/Web/App cho cộng đồng Việt',
  headerBackgroundColor: '#1d3557',
  headerBackgroundImageUrl: null,
  headerBackgroundSize: 'cover',
  headerBackgroundAttachment: 'scroll',
  headerBackgroundPositionX: 50,
  headerBackgroundPositionY: 50,
  headerMinHeight: 260,
  headerTitleColor: '#c7d2e0',
  headerTitleFontFamily: null,
  headerTitleBold: false,
  headerSloganColor: '#ffffff',
  headerSloganFontFamily: null,
  headerSloganBold: true,
  headerSloganItalic: false,
  gaTrackingId: '',
  googleSiteVerification: '',
  footerText: 'KHOMANGUON Version 2 (C) 2026. All Rights Reserved.',
  rateLimits: {
    enabled: true,
    login: { windowSec: 600, max: 5 },
    register: { windowSec: 3600, max: 5 },
    forgotPassword: { windowSec: 900, max: 3 },
    resetPassword: { windowSec: 900, max: 5 },
    search: { windowSec: 60, max: 30 },
    commentCreate: { windowSec: 60, max: 10 },
    feedbackCreate: { windowSec: 3600, max: 5 },
    newsletterSubscribe: { windowSec: 3600, max: 5 },
  },
  maintenanceMode: {
    enabled: false,
    message:
      'Website đang được bảo trì để nâng cấp trải nghiệm tốt hơn. Vui lòng quay lại sau ít phút!',
  },
};
