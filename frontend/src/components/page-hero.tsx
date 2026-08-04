import { fontVar } from "@/lib/fonts";
import type { GeneralSettings } from "@/lib/types";

// Banner dùng chung phong cách hero trang chủ (app/page.tsx) nhưng nội dung riêng theo từng trang
// (vd "Ví $P" thay vì tiêu đề site) — cùng đọc màu/ảnh nền từ Cài đặt chung để đồng bộ nhận diện.
export function PageHero({
  settings,
  eyebrow,
  title,
  minHeight = 160,
}: {
  settings: GeneralSettings;
  eyebrow: string;
  title: string;
  minHeight?: number;
}) {
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
      className="flex flex-col justify-center rounded-lg px-8 py-8 text-white"
      style={{ ...heroStyle, minHeight }}
    >
      <p
        className="font-mono text-xs uppercase tracking-widest"
        style={{
          color: settings.headerTitleColor,
          fontFamily: fontVar(settings.headerTitleFontFamily),
          fontWeight: settings.headerTitleBold ? 700 : undefined,
        }}
      >
        {eyebrow}
      </p>
      <h1
        className="mt-2 text-2xl"
        style={{
          color: settings.headerSloganColor,
          fontFamily: fontVar(settings.headerSloganFontFamily),
          fontWeight: settings.headerSloganBold ? 700 : undefined,
        }}
      >
        {title}
      </h1>
    </section>
  );
}
