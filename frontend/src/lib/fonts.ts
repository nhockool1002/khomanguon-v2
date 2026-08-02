import {
  Inter,
  Roboto,
  Open_Sans,
  Montserrat,
  Poppins,
  Lato,
  Nunito,
  Merriweather,
  Playfair_Display,
  Oswald,
  Raleway,
  Ubuntu,
  Quicksand,
  Work_Sans,
  Rubik,
  Mulish,
  Karla,
  DM_Sans,
  Space_Grotesk,
  Bebas_Neue,
} from "next/font/google";

// 20 font cho phép Admin chọn làm style badge role (title/color/bold/italic/font) — PHẢI giữ
// đồng bộ key với backend/src/roles/font-options.constant.ts (không import chéo được giữa 2 app).
// Mỗi font export 1 CSS var "--font-role-<key>", gắn vào <html> ở layout.tsx để dùng được ở bất kỳ
// đâu qua style={{ fontFamily: "var(--font-role-<key>)" }} (xem components/role-badge.tsx).
const inter = Inter({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-inter" });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-roboto" });
const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-open-sans" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-montserrat" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-poppins" });
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-lato" });
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-nunito" });
const merriweather = Merriweather({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-merriweather" });
const playfairDisplay = Playfair_Display({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-playfair-display" });
const oswald = Oswald({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-oswald" });
const raleway = Raleway({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-raleway" });
const ubuntu = Ubuntu({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-ubuntu" });
const quicksand = Quicksand({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-quicksand" });
const workSans = Work_Sans({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-work-sans" });
const rubik = Rubik({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-rubik" });
const mulish = Mulish({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-mulish" });
const karla = Karla({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-karla" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-dm-sans" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-role-space-grotesk" });
const bebasNeue = Bebas_Neue({ subsets: ["latin"], weight: ["400"], variable: "--font-role-bebas-neue" });

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
