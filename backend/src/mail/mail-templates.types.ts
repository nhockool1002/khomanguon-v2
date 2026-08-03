// Template email thông báo nội bộ gửi cho Admin khi có sự kiện đáng chú ý (nạp tiền/tải file
// thành công) — khác với mail.service.ts's sendVerificationEmail/sendPasswordResetEmail vốn gửi
// CHO USER. Lưu trong SiteSetting (key = MAIL_TEMPLATES_KEY), theo đúng mẫu key/value chung đã
// dùng cho sepay_config/general_settings — không cần model riêng.
export interface MailTemplateConfig {
  subject: string;
  html: string;
}

export interface MailTemplates {
  // Email admin nhận thông báo — để trống thì bỏ qua, không gửi (tránh gửi nhầm khi chưa cấu hình).
  notifyEmail: string;
  topupSuccess: MailTemplateConfig;
  downloadUnlock: MailTemplateConfig;
  // Gửi CHO USER (không phải thông báo Admin) — dùng chung cho cả luồng tự phục vụ
  // (/auth/forgot-password) lẫn admin bấm "Đặt lại mật khẩu" ở trang quản lý user.
  passwordReset: MailTemplateConfig;
}

export const MAIL_TEMPLATES_KEY = 'mail_templates';

const TOPUP_SUCCESS_HTML = `<p>Xin chào Admin,</p>
<p>Người dùng <strong>[{{displayName}}]</strong> đã thực hiện một khoản thanh toán tại KHOMANGUON.ORG với thông tin như sau:</p>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
  <tr style="background:#1d3557;color:#fff;">
    <th>User</th>
    <th>Số tiền nạp</th>
    <th>Phương thức thanh toán</th>
    <th>Mã giao dịch</th>
  </tr>
  <tr>
    <td>{{displayName}}</td>
    <td>{{amountVnd}} VNĐ</td>
    <td>{{paymentMethod}}</td>
    <td>{{transactionCode}}</td>
  </tr>
</table>
<p>Vui lòng truy cập trang quản trị để đánh giá.</p>`;

const DOWNLOAD_UNLOCK_HTML = `<p>Xin chào Admin,</p>
<p>Người dùng <strong>[{{displayName}}]</strong> đã tải xuống 1 file tại KHOMANGUON.ORG với thông tin như sau:</p>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
  <tr style="background:#1d3557;color:#fff;">
    <th>User</th>
    <th>Bài viết</th>
    <th>File</th>
    <th>Giá</th>
  </tr>
  <tr>
    <td>{{displayName}}</td>
    <td>{{postTitle}}</td>
    <td>{{fileName}}</td>
    <td>{{priceP}} $P</td>
  </tr>
</table>
<p>Vui lòng truy cập trang quản trị để đánh giá.</p>`;

const PASSWORD_RESET_HTML = `<p>Chào {{displayName}},</p>
<p>Bấm vào link sau để đặt lại mật khẩu (hết hạn sau 15 phút, chỉ dùng được 1 lần):</p>
<p><a href="{{resetUrl}}">{{resetUrl}}</a></p>
<p>Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>`;

export const DEFAULT_MAIL_TEMPLATES: MailTemplates = {
  // Mặc định email chủ dự án — Admin đổi lại qua /quan-tri/cai-dat/email nếu cần. Email này LUÔN
  // được cộng thêm vào danh sách nhận (cùng với chính email của user vừa nạp/tải) — xem
  // mail.service.ts sendNotification().
  notifyEmail: 'nhut.nguyenminh.it@gmail.com',
  topupSuccess: {
    subject:
      'User [{{displayName}}] đã thực hiện một khoản thanh toán tại KHOMANGUON.ORG [{{timestamp}}]',
    html: TOPUP_SUCCESS_HTML,
  },
  downloadUnlock: {
    subject:
      'User [{{displayName}}] đã tải file tại KHOMANGUON.ORG [{{timestamp}}]',
    html: DOWNLOAD_UNLOCK_HTML,
  },
  passwordReset: {
    subject: 'Đặt lại mật khẩu khomanguon',
    html: PASSWORD_RESET_HTML,
  },
};

// Thay thế {{key}} bằng giá trị tương ứng trong vars — không dùng thư viện template engine ngoài,
// đủ dùng cho nhu cầu thông báo đơn giản này (khớp quy ước "không thêm thư viện khi chưa cần").
export function renderMailTemplate(
  template: MailTemplateConfig,
  vars: Record<string, string>,
): { subject: string; html: string } {
  const apply = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? '');
  return { subject: apply(template.subject), html: apply(template.html) };
}
