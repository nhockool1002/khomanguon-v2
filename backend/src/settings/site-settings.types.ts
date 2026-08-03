export type HeaderBackgroundSize = 'cover' | 'contain' | 'auto';
export type HeaderBackgroundAttachment = 'scroll' | 'fixed';

// Lưu trong SiteSetting.value (key = GENERAL_SETTINGS_KEY) — không có model riêng, theo đúng
// pattern key/value chung đã dùng cho sepay_config (xem sepay/sepay-config.types.ts).
export interface GeneralSettings {
  postsPerPage: number;
  headerTitle: string;
  headerSlogan: string;
  headerBackgroundColor: string;
  headerBackgroundImageUrl: string | null;
  headerBackgroundSize: HeaderBackgroundSize;
  headerBackgroundAttachment: HeaderBackgroundAttachment;
  // % vị trí ảnh nền (0 = trái/trên, 100 = phải/dưới) — cho phép "kéo" ảnh tới vị trí tuỳ ý.
  headerBackgroundPositionX: number;
  headerBackgroundPositionY: number;
}

export const GENERAL_SETTINGS_KEY = 'general_settings';

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  postsPerPage: 9,
  headerTitle: 'khomanguon.vn',
  headerSlogan:
    'Mở kho, dựng lại thanh xuân — kho mã nguồn Game/Web/App cho cộng đồng Việt',
  headerBackgroundColor: '#1d3557',
  headerBackgroundImageUrl: null,
  headerBackgroundSize: 'cover',
  headerBackgroundAttachment: 'scroll',
  headerBackgroundPositionX: 50,
  headerBackgroundPositionY: 50,
};
