import { fontVar } from "@/lib/fonts";
import type { GeneralSettings } from "@/lib/types";
import { LogoMark } from "./logo-mark";

// Banner cùng phong cách với khối hero trang chủ (app/page.tsx) — dùng cho trang Đăng nhập/Đăng ký
// để có logo + nhận diện thương hiệu thay vì để form trơ trọi trên nền trắng.
export function AuthBanner({ settings }: { settings: GeneralSettings }) {
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
      className="flex flex-col items-center justify-center gap-3 px-8 py-12 text-center text-white"
      style={heroStyle}
    >
      <LogoMark size={44} />
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
          className="max-w-md text-lg"
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
