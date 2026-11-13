// Lọc bot/crawler/monitor khỏi số liệu Dashboard (PLAN 2026-11-13, yêu cầu "đảm bảo tính trung
// thực") — danh sách pattern phổ biến, không cần toàn diện 100% (đồng đánh đổi chấp nhận được như
// mọi UA-based bot filter: bot cố tình giả UA người dùng thật vẫn lọt, nhưng chặn được đa số traffic
// tự động thông thường: search engine, SEO tool, uptime monitor, HTTP client mặc định).
const BOT_UA_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|curl|wget|python-requests|python-urllib|scrapy|headless|phantomjs|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|bytespider|preview|pingdom|uptimerobot|monitor|go-http-client|okhttp|axios\/|node-fetch/i;

export function isBotUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent) return true; // không gửi User-Agent — gần như chắc chắn là script, không phải trình duyệt thật
  return BOT_UA_PATTERN.test(userAgent);
}
