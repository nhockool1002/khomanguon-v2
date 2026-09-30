import localFont from "next/font/local";

// 20 font cho phép Admin chọn làm style badge role (title/color/bold/italic/font) — PHẢI giữ
// đồng bộ key với backend/src/roles/font-options.constant.ts (không import chéo được giữa 2 app).
// Mỗi font export 1 CSS var "--font-role-<key>", gắn vào <html> ở layout.tsx để dùng được ở bất kỳ
// đâu qua style={{ fontFamily: "var(--font-role-<key>)" }} (xem components/role-badge.tsx).
//
// Dùng next/font/local với file woff2 (subset latin) lưu sẵn trong src/fonts — KHÔNG dùng
// next/font/google: bản đó tải CSS/font từ Google lúc build, và từ datacenter Mỹ (Vercel, GitHub
// Actions) Turbopack báo "next/font/google queries have exactly one entry" làm hỏng build dù máy
// local build được. Font variable (1 file cho mọi độ đậm) khai báo weight "400 700".

const inter = localFont({ src: "../fonts/inter-latin.woff2", weight: "400 700", variable: "--font-role-inter" });
const roboto = localFont({ src: "../fonts/roboto-latin.woff2", weight: "400 700", variable: "--font-role-roboto" });
const openSans = localFont({ src: "../fonts/open-sans-latin.woff2", weight: "400 700", variable: "--font-role-open-sans" });
const montserrat = localFont({ src: "../fonts/montserrat-latin.woff2", weight: "400 700", variable: "--font-role-montserrat" });
const poppins = localFont({
  src: [
    { path: "../fonts/poppins-400-latin.woff2", weight: "400" },
    { path: "../fonts/poppins-700-latin.woff2", weight: "700" },
  ],
  variable: "--font-role-poppins",
});
const lato = localFont({
  src: [
    { path: "../fonts/lato-400-latin.woff2", weight: "400" },
    { path: "../fonts/lato-700-latin.woff2", weight: "700" },
  ],
  variable: "--font-role-lato",
});
const nunito = localFont({ src: "../fonts/nunito-latin.woff2", weight: "400 700", variable: "--font-role-nunito" });
const merriweather = localFont({ src: "../fonts/merriweather-latin.woff2", weight: "400 700", variable: "--font-role-merriweather" });
const playfairDisplay = localFont({ src: "../fonts/playfair-display-latin.woff2", weight: "400 700", variable: "--font-role-playfair-display" });
const oswald = localFont({ src: "../fonts/oswald-latin.woff2", weight: "400 700", variable: "--font-role-oswald" });
const raleway = localFont({ src: "../fonts/raleway-latin.woff2", weight: "400 700", variable: "--font-role-raleway" });
const ubuntu = localFont({
  src: [
    { path: "../fonts/ubuntu-400-latin.woff2", weight: "400" },
    { path: "../fonts/ubuntu-700-latin.woff2", weight: "700" },
  ],
  variable: "--font-role-ubuntu",
});
const quicksand = localFont({ src: "../fonts/quicksand-latin.woff2", weight: "400 700", variable: "--font-role-quicksand" });
const workSans = localFont({ src: "../fonts/work-sans-latin.woff2", weight: "400 700", variable: "--font-role-work-sans" });
const rubik = localFont({ src: "../fonts/rubik-latin.woff2", weight: "400 700", variable: "--font-role-rubik" });
const mulish = localFont({ src: "../fonts/mulish-latin.woff2", weight: "400 700", variable: "--font-role-mulish" });
const karla = localFont({ src: "../fonts/karla-latin.woff2", weight: "400 700", variable: "--font-role-karla" });
const dmSans = localFont({ src: "../fonts/dm-sans-latin.woff2", weight: "400 700", variable: "--font-role-dm-sans" });
const spaceGrotesk = localFont({ src: "../fonts/space-grotesk-latin.woff2", weight: "400 700", variable: "--font-role-space-grotesk" });
const bebasNeue = localFont({ src: "../fonts/bebas-neue-latin.woff2", weight: "400", variable: "--font-role-bebas-neue" });

export const ROLE_FONTS = [
  inter,
  roboto,
  openSans,
  montserrat,
  poppins,
  lato,
  nunito,
  merriweather,
  playfairDisplay,
  oswald,
  raleway,
  ubuntu,
  quicksand,
  workSans,
  rubik,
  mulish,
  karla,
  dmSans,
  spaceGrotesk,
  bebasNeue,
];

export const ROLE_FONT_VARS = ROLE_FONTS.map((f) => f.variable).join(" ");

export const FONT_OPTIONS: { key: string; label: string }[] = [
  { key: "inter", label: "Inter" },
  { key: "roboto", label: "Roboto" },
  { key: "open-sans", label: "Open Sans" },
  { key: "montserrat", label: "Montserrat" },
  { key: "poppins", label: "Poppins" },
  { key: "lato", label: "Lato" },
  { key: "nunito", label: "Nunito" },
  { key: "merriweather", label: "Merriweather" },
  { key: "playfair-display", label: "Playfair Display" },
  { key: "oswald", label: "Oswald" },
  { key: "raleway", label: "Raleway" },
  { key: "ubuntu", label: "Ubuntu" },
  { key: "quicksand", label: "Quicksand" },
  { key: "work-sans", label: "Work Sans" },
  { key: "rubik", label: "Rubik" },
  { key: "mulish", label: "Mulish" },
  { key: "karla", label: "Karla" },
  { key: "dm-sans", label: "DM Sans" },
  { key: "space-grotesk", label: "Space Grotesk" },
  { key: "bebas-neue", label: "Bebas Neue" },
];

export function fontVar(key: string | null): string | undefined {
  if (!key) return undefined;
  return `var(--font-role-${key})`;
}
