-- Link sản phẩm Buy Me a Coffee (Shop/Extras) mặc định cho 4 gói nạp quốc tế — chỉ điền khi gói vẫn là
-- gói mặc định và chưa có link (không ghi đè link Admin đã sửa). Admin đổi lại được ở "Cài đặt thanh
-- toán quốc tế".
UPDATE "intl_topup_packages" SET "bmcExtraUrl" = 'https://buymeacoffee.com/nhutnm/e/581629'
  WHERE "id" = 'intl_pkg_default_10' AND "bmcExtraUrl" IS NULL;
UPDATE "intl_topup_packages" SET "bmcExtraUrl" = 'https://buymeacoffee.com/nhutnm/e/581634'
  WHERE "id" = 'intl_pkg_default_20' AND "bmcExtraUrl" IS NULL;
UPDATE "intl_topup_packages" SET "bmcExtraUrl" = 'https://buymeacoffee.com/nhutnm/e/581636'
  WHERE "id" = 'intl_pkg_default_50' AND "bmcExtraUrl" IS NULL;
UPDATE "intl_topup_packages" SET "bmcExtraUrl" = 'https://buymeacoffee.com/nhutnm/e/581637'
  WHERE "id" = 'intl_pkg_default_100' AND "bmcExtraUrl" IS NULL;
