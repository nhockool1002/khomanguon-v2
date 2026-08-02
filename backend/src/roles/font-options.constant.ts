// Danh sách 20 font cho phép chọn làm style badge role — PHẢI giữ đồng bộ với
// frontend/src/lib/fonts.ts (không import chéo được giữa 2 app). Key khớp CSS var
// "--font-role-<key>" khai báo ở frontend/src/app/layout.tsx.
export const FONT_KEYS = [
  'inter',
  'roboto',
  'open-sans',
  'montserrat',
  'poppins',
  'lato',
  'nunito',
  'merriweather',
  'playfair-display',
  'oswald',
  'raleway',
  'ubuntu',
  'quicksand',
  'work-sans',
  'rubik',
  'mulish',
  'karla',
  'dm-sans',
  'space-grotesk',
  'bebas-neue',
] as const;

export type FontKey = (typeof FONT_KEYS)[number];
