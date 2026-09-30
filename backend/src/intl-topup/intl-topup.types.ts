// Cấu hình "Cài đặt thanh toán quốc tế" — lưu SiteSetting (key INTL_PAYMENT_SETTING_KEY) theo đúng
// pattern key/value chung của sepay_config/mail_templates. Gói nạp nằm ở bảng IntlTopupPackage riêng.
export interface IntlPaymentSettings {
  // Trang Buy Me a Coffee — dùng khi gói không có link Extras riêng.
  bmcPageUrl: string;
  // Tỉ giá USD → VNĐ do Admin nhập. $P mặc định của 1 gói = USD × usdToVndRate ÷ tỉ giá cơ bản
  // VNĐ/$P của SePay (chỉ ĐỌC từ sepay_config, không sửa gì luồng nội địa).
  usdToVndRate: number;
  // Hạn để user thanh toán + bấm "I have paid" trước khi yêu cầu tự chuyển EXPIRED.
  paymentWindowHours: number;
  // Số yêu cầu AWAITING_PAYMENT + PENDING tối đa 1 user được giữ cùng lúc (chống spam).
  maxOpenOrdersPerUser: number;
  // Thông tin người bán in trên invoice PDF.
  sellerName: string;
  sellerEmail: string;
}

export const INTL_PAYMENT_SETTING_KEY = 'intl_payment_settings';

export const DEFAULT_INTL_PAYMENT_SETTINGS: IntlPaymentSettings = {
  bmcPageUrl: 'https://buymeacoffee.com/nhutnm',
  usdToVndRate: 27000,
  paymentWindowHours: 24,
  maxOpenOrdersPerUser: 3,
  sellerName: 'KHOMANGUON.ORG',
  sellerEmail: 'admin@khomanguon.org',
};

// Mã đối soát dán vào lời nhắn BMC — tiền tố KMN- khác hẳn "GD" của SePay nên webhook SePay (khớp
// theo chuỗi con) không bao giờ ăn nhầm; bỏ ký tự dễ nhầm (0/O, 1/I/L).
export const INTL_CODE_PREFIX = 'KMN-';
export const INTL_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const INTL_CODE_LENGTH = 6;
