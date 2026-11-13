// Zone Monetag của site v2.khomanguon.org (dashboard Monetag, site ID 3444629) — tạo thủ công ngày
// 2026-11-13, không đổi theo Admin (chỉ bật/tắt tổng qua GeneralSettings.adsEnabled, xem layout.tsx).
// Đổi zone (xoá/tạo lại trên Monetag) thì sửa trực tiếp các hằng số dưới đây.

// Onclick (Popunder, zone 12252849) — script gắn listener click toàn trang (Monetag tự giới hạn tần
// suất hiển thị), nên chỉ cần nhúng 1 lần ở layout là mọi click trên site (kể cả nút "Tải xuống")
// đều có thể kích hoạt — không cần sửa riêng từng nút download.
export const ADS_ONCLICK_SCRIPT = `(function(s){s.dataset.zone='12252849',s.src='https://al5sm.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))`;

// Vignette Banner (zone 12252852) — banner native tự chèn, không chiếm layout, hiển thị khi cuộn.
export const ADS_VIGNETTE_SCRIPT = `(function(s){s.dataset.zone='12252852',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))`;

// Push Notifications (zone 12252850) — CHƯA triển khai: format này cần ghi đè file /sw.js ở public
// root, nhưng file đó đang là file xác minh quyền sở hữu site với Monetag (zoneId 11552003 cũ, xem
// commit "thêm file xác minh Monetag") — ghi đè có rủi ro làm site mất trạng thái Verified, kéo theo
// mất luôn Onclick+Vignette bên trên. Muốn bật Push phải hỏi Monetag support cách verify site bằng
// cách khác trước, rồi mới đổi sw.js sang nội dung zone 12252850 (xem lịch sử trò chuyện lúc tạo).
