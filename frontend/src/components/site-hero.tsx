import { fontVar } from "@/lib/fonts";
import type { GeneralSettings } from "@/lib/types";

// Banner "hero" dùng CHUNG NGUYÊN VĂN với trang chủ (trước đây trích từ app/page.tsx) — luôn hiện
// đúng headerTitle/headerSlogan cấu hình ở Cài đặt chung, KHÔNG override bằng text riêng theo
// từng trang (yêu cầu thực tế: trang Nạp tiền phải dùng chung banner với trang chủ).
export function SiteHero({ settings }: { settings: GeneralSettings }) {
  const heroStyle: React.CSSProperties = settings.headerBackgroundImageUrl
    ? {
        backgroundColor: settings.headerBackgroundColor,
        backgroundImage: `url(${settings.headerBackgroundImageUrl})`,
        backgroundSize: settings.headerBackgroundSize,
        backgroundAttachment: settings.headerBackgroundAttachment,
        backgroundPosition: `${settings.headerBackgroundPositionX}% ${settings.headerBackgroundPositionY}%`,
        backgroundRepeat: "no-repeat",
      }
    : { backgroundColor: settings.headerBackgroundColor };

  return (
    <section
      className="flex flex-col justify-center rounded-lg px-8 py-10 text-white"
      style={{ ...heroStyle, minHeight: settings.headerMinHeight }}
    >
      <p
        className="font-mono text-xs uppercase tracking-widest"
        style={{
          color: settings.headerTitleColor,
          fontFamily: fontVar(settings.headerTitleFontFamily),
          fontWeight: settings.headerTitleBold ? 700 : undefined,
        }}
      >
        {settings.headerTitle}
      </p>
      {settings.headerSlogan && (
        <h1
          className="mt-2 max-w-lg text-2xl"
          style={{
            color: settings.headerSloganColor,
            fontFamily: fontVar(settings.headerSloganFontFamily),
            fontWeight: settings.headerSloganBold ? 700 : undefined,
            fontStyle: settings.headerSloganItalic ? "italic" : undefined,
          }}
        >
          {settings.headerSlogan}
        </h1>
      )}
    </section>
  );
}
