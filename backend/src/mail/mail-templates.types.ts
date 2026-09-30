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
  // Báo lỗi link die (UC25) — 2 email khác hướng nhau: linkReportAdmin gửi CHO Admin (notifyEmail)
  // khi có báo cáo mới; linkReportResolved gửi CHO USER đã báo cáo khi Admin xử lý xong.
  linkReportAdmin: MailTemplateConfig;
  linkReportResolved: MailTemplateConfig;
  // Gửi CHO USER lúc đăng ký/bấm "Gửi lại email xác minh" — trước đây hardcode trong
  // mail.service.ts, giờ admin-editable như passwordReset.
  verifyEmail: MailTemplateConfig;
  // Góp ý mới từ modal Feedback — gửi CHO Admin (notifyEmail).
  feedbackAdmin: MailTemplateConfig;
  // Admin trả lời góp ý (trang Quản trị > Góp ý người dùng) — gửi CHO người góp ý. Modal Feedback
  // bắt buộc email với khách ẩn danh nên góp ý mới luôn có địa chỉ để phản hồi.
  feedbackReply: MailTemplateConfig;
  // Nạp quốc tế qua Buy Me a Coffee (intl-topup module). User-facing viết tiếng Anh (khách quốc tế),
  // bản gửi Admin giữ tiếng Việt như các thông báo Admin khác.
  intlTopupPendingUser: MailTemplateConfig;
  intlTopupPendingAdmin: MailTemplateConfig;
  // Gửi CẢ user lẫn notifyEmail, đính kèm invoice PDF.
  intlTopupApproved: MailTemplateConfig;
  intlTopupRejected: MailTemplateConfig;
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

const LINK_REPORT_ADMIN_HTML = `<p>Xin chào Admin,</p>
<p>Người dùng <strong>[{{displayName}}]</strong> vừa báo lỗi 1 link tải trên KHOMANGUON.ORG:</p>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
  <tr style="background:#1d3557;color:#fff;">
    <th>User</th>
    <th>Bài viết</th>
    <th>File</th>
    <th>Ghi chú</th>
  </tr>
  <tr>
    <td>{{displayName}}</td>
    <td>{{postTitle}}</td>
    <td>{{fileName}}</td>
    <td>{{note}}</td>
  </tr>
</table>
<p>Vui lòng truy cập trang quản trị để xử lý.</p>`;

const LINK_REPORT_RESOLVED_HTML = `<p>Chào {{displayName}},</p>
<p>Báo cáo lỗi link tải của bạn cho bài viết <strong>{{postTitle}}</strong> (file {{fileName}}) đã được xử lý xong.</p>
<p>Cảm ơn bạn đã giúp KHOMANGUON.ORG cải thiện chất lượng link tải!</p>`;

const VERIFY_EMAIL_HTML = `<p>Chào {{displayName}},</p>
<p>Bấm vào link sau để xác minh email (hết hạn sau 24 giờ):</p>
<p><a href="{{verifyUrl}}">{{verifyUrl}}</a></p>`;

const FEEDBACK_ADMIN_HTML = `<p>Xin chào Admin,</p>
<p>Có 1 góp ý mới gửi từ KHOMANGUON.ORG:</p>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
  <tr style="background:#1d3557;color:#fff;">
    <th>Người gửi</th>
    <th>Email liên hệ</th>
    <th>Nội dung</th>
  </tr>
  <tr>
    <td>{{displayName}}</td>
    <td>{{contactEmail}}</td>
    <td>{{message}}</td>
  </tr>
</table>
<p>Vui lòng truy cập trang quản trị để xem/xử lý.</p>`;

const FEEDBACK_REPLY_HTML = `<p>Chào {{displayName}},</p>
<p>Cảm ơn bạn đã gửi góp ý tới KHOMANGUON.ORG. Đội ngũ quản trị đã phản hồi như sau:</p>
<blockquote style="margin:0 0 12px;padding:8px 12px;border-left:4px solid #1d3557;background:#f4f6f9;">{{replyMessage}}</blockquote>
<p style="color:#71717a;">Góp ý của bạn:</p>
<blockquote style="margin:0;padding:8px 12px;border-left:4px solid #d4d4d8;color:#52525b;">{{originalMessage}}</blockquote>
<p>Trân trọng,<br/>KHOMANGUON.ORG</p>`;

const INTL_TOPUP_PENDING_USER_HTML = `<p>Hi {{displayName}},</p>
<p>We have received your international top-up request. It is now <strong>pending</strong> while our team verifies your payment on Buy Me a Coffee.</p>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
  <tr><td>Reference code</td><td><strong>{{code}}</strong></td></tr>
  <tr><td>Package</td><td>\${{amountUsd}} USD → {{amountP}} $P</td></tr>
  <tr><td>Buy Me a Coffee email</td><td>{{payerEmail}}</td></tr>
</table>
<p>You will receive another email once the transaction is approved (with your invoice) or rejected.</p>
<p>KHOMANGUON.ORG</p>`;

const INTL_TOPUP_PENDING_ADMIN_HTML = `<p>Xin chào Admin,</p>
<p>User <strong>[{{displayName}}]</strong> ({{userEmail}}) báo đã thanh toán 1 giao dịch quốc tế qua Buy Me a Coffee — cần kiểm tra trên ví BMC:</p>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
  <tr style="background:#1d3557;color:#fff;">
    <th>Mã giao dịch</th>
    <th>Số tiền</th>
    <th>$P</th>
    <th>Email trên BMC</th>
  </tr>
  <tr>
    <td>{{code}}</td>
    <td>\${{amountUsd}} USD</td>
    <td>{{amountP}} $P</td>
    <td>{{payerEmail}}</td>
  </tr>
</table>
<p>Vào Quản lý Giao Dịch → Duyệt nạp quốc tế để xác nhận hoặc từ chối.</p>`;

const INTL_TOPUP_APPROVED_HTML = `<p>Hi {{displayName}},</p>
<p>Your international top-up has been <strong>approved</strong> and <strong>{{creditedP}} $P</strong> has been added to your wallet.</p>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
  <tr><td>Invoice</td><td>{{invoiceNumber}}</td></tr>
  <tr><td>Reference code</td><td>{{code}}</td></tr>
  <tr><td>Amount received</td><td>\${{receivedUsd}} USD</td></tr>
  <tr><td>Credited</td><td>{{creditedP}} $P</td></tr>
  <tr><td>Confirmed at</td><td>{{approvedAt}}</td></tr>
</table>
<p>Your invoice is attached to this email. $P are digital credits and are non-refundable once delivered.</p>
<p>KHOMANGUON.ORG</p>`;

const INTL_TOPUP_REJECTED_HTML = `<p>Hi {{displayName}},</p>
<p>Unfortunately your international top-up request <strong>{{code}}</strong> (\${{amountUsd}} USD) was <strong>rejected</strong>.</p>
<p>Reason: {{reason}}</p>
<p>If you believe this is a mistake, please reply via the Feedback button on our website and include your reference code.</p>
<p>KHOMANGUON.ORG</p>`;

export const DEFAULT_MAIL_TEMPLATES: MailTemplates = {
  // Mặc định email chủ dự án — Admin đổi lại qua /admin/settings/email nếu cần. Email này LUÔN
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
  linkReportAdmin: {
    subject:
      'User [{{displayName}}] báo lỗi link tải tại KHOMANGUON.ORG [{{timestamp}}]',
    html: LINK_REPORT_ADMIN_HTML,
  },
  linkReportResolved: {
    subject: 'Báo cáo lỗi link tải của bạn đã được xử lý — KHOMANGUON.ORG',
    html: LINK_REPORT_RESOLVED_HTML,
  },
  verifyEmail: {
    subject: 'Xác minh email khomanguon',
    html: VERIFY_EMAIL_HTML,
  },
  feedbackAdmin: {
    subject: 'Góp ý mới từ KHOMANGUON.ORG [{{timestamp}}]',
    html: FEEDBACK_ADMIN_HTML,
  },
  feedbackReply: {
    subject: 'Phản hồi góp ý của bạn — KHOMANGUON.ORG',
    html: FEEDBACK_REPLY_HTML,
  },
  intlTopupPendingUser: {
    subject: 'Your top-up {{code}} is pending review — KHOMANGUON.ORG',
    html: INTL_TOPUP_PENDING_USER_HTML,
  },
  intlTopupPendingAdmin: {
    subject:
      'User [{{displayName}}] có giao dịch quốc tế BMC cần kiểm tra — {{code}} [{{timestamp}}]',
    html: INTL_TOPUP_PENDING_ADMIN_HTML,
  },
  intlTopupApproved: {
    subject: 'Top-up approved — Invoice {{invoiceNumber}} — KHOMANGUON.ORG',
    html: INTL_TOPUP_APPROVED_HTML,
  },
  intlTopupRejected: {
    subject: 'Your top-up {{code}} was rejected — KHOMANGUON.ORG',
    html: INTL_TOPUP_REJECTED_HTML,
  },
};

// Nội dung người dùng/Admin tự nhập (góp ý, phản hồi) chèn vào template HTML — escape để không
// chèn được thẻ HTML tuỳ ý vào email, giữ xuống dòng bằng <br/>.
export function escapeMailText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r?\n/g, '<br/>');
}

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
