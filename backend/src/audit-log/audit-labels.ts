// Nhãn tiếng Việt cho từng thao tác quản trị được AdminAuditInterceptor ghi tự động — key là
// "<TênController>.<tênHandler>". Thiếu nhãn thì trang Nhật ký hiển thị "METHOD /đường-dẫn" (vẫn
// ghi log đầy đủ), audit-labels.spec.ts bắt buộc mọi route quản trị phải có nhãn ở đây.
export const AUDIT_ROUTE_LABELS: Record<string, string> = {
  // Bài viết & nội dung
  'PostsController.create': 'Tạo bài viết',
  'PostsController.update': 'Sửa bài viết',
  'PostsController.remove': 'Xoá bài viết',
  'PostsController.setVisibility': 'Ẩn / hiện bài viết',
  'CategoriesController.create': 'Tạo danh mục',
  'CategoriesController.reorder': 'Sắp xếp danh mục',
  'CategoriesController.update': 'Sửa danh mục',
  'CategoriesController.remove': 'Xoá danh mục',
  'TagsController.create': 'Tạo tag',
  'TagsController.update': 'Sửa tag',
  'TagsController.remove': 'Xoá tag',
  'UploadsController.upload': 'Tải ảnh lên (bài viết)',
  'MediaController.upload': 'Tải file lên Thư viện Media',
  'MediaController.remove': 'Xoá file Thư viện Media',
  'ContentImportController.fromDocx': 'Nhập tài liệu Word vào bài viết',
  'ContentImportController.fromHtml': 'Nhập HTML vào bài viết',
  'ContentImportController.fromPdf': 'Nhập PDF vào bài viết',
  'CommentsController.updateStatus': 'Duyệt / ẩn bình luận',
  'CommentsController.setPinned': 'Ghim / bỏ ghim bình luận',
  'CommentsController.remove': 'Xoá bình luận',

  // Giao diện
  'MenusController.create': 'Tạo menu',
  'MenusController.reorder': 'Sắp xếp menu',
  'MenusController.update': 'Sửa menu',
  'MenusController.remove': 'Xoá menu',
  'WidgetsController.create': 'Tạo widget',
  'WidgetsController.reorder': 'Sắp xếp widget',
  'WidgetsController.update': 'Sửa widget',
  'WidgetsController.remove': 'Xoá widget',
  'SlidersController.create': 'Tạo slider',
  'SlidersController.update': 'Sửa slider',
  'SlidersController.remove': 'Xoá slider',

  // Link tải & File Cloud
  'DownloadLinksController.create': 'Thêm link tải',
  'DownloadLinkController.update': 'Sửa link tải',
  'DownloadLinkController.remove': 'Xoá link tải',
  'LinkReportsController.resolve': 'Xử lý báo lỗi link tải',
  'CloudFilesController.presignUpload': 'Tạo link upload File Cloud',
  'CloudFilesController.initMultipartUpload':
    'Bắt đầu upload nhiều phần File Cloud',
  'CloudFilesController.presignUploadPart': 'Tạo link upload 1 phần File Cloud',
  'CloudFilesController.completeMultipartUpload': 'Hoàn tất upload File Cloud',
  'CloudFilesController.abortMultipartUpload': 'Huỷ upload File Cloud',
  'CloudFilesController.remove': 'Xoá file trên Cloud',
  'CloudUploadHistoryController.create': 'Ghi lịch sử upload File Cloud',

  // User, vai trò, góp ý
  'UsersController.sendResetPassword': 'Gửi email đặt lại mật khẩu cho user',
  'UsersController.updateStatus': 'Khoá / mở khoá user',
  'RolesController.create': 'Tạo vai trò',
  'RolesController.update': 'Sửa vai trò / quyền',
  'RolesController.remove': 'Xoá vai trò',
  'FeedbackController.resolve': 'Đánh dấu góp ý đã xử lý',
  'FeedbackController.reply': 'Phản hồi góp ý qua email',

  // Giao dịch & thanh toán
  'WalletController.deleteTransactionsByFilter': 'Xoá lịch sử giao dịch ví',
  'SepayConfigController.updateConfig': 'Lưu cài đặt SePay',
  'SepayConfigController.testConnection': 'Thử kết nối SePay',
  'IntlTopupController.updateSettings': 'Lưu cài đặt thanh toán quốc tế',
  'SubscriptionPlansController.create': 'Tạo gói Subscription',
  'SubscriptionPlansController.update': 'Sửa gói Subscription',
  'SubscriptionPlansController.remove': 'Xoá gói Subscription',

  // Cài đặt hệ thống
  'SiteSettingsController.updateGeneral': 'Lưu cài đặt chung',
  'RecaptchaController.updateConfig': 'Lưu cài đặt reCAPTCHA',
  'MailTemplatesController.updateTemplates': 'Lưu template email',
  'MailTemplatesController.testSend': 'Gửi thử email',
  'NewsletterController.updateConfig': 'Lưu cài đặt bản tin',
  'NewsletterController.runNow': 'Gửi bản tin ngay',
  'StorageProvidersController.create': 'Thêm Storage Provider',
  'StorageProvidersController.update': 'Sửa Storage Provider',
  'StorageProvidersController.remove': 'Xoá Storage Provider',
  'DbBackupController.updateConfig': 'Lưu cài đặt Backup DB',
  'DbBackupController.runNow': 'Chạy Backup DB ngay',
  'DbBackupController.deleteRecord': 'Xoá bản Backup DB',
  'CacheController.clear': 'Xoá cache',
};
