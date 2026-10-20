// Danh sách theme bầu trời/thời tiết — dùng chung giữa seed.ts (dữ liệu mặc định), DTO validate
// (@IsIn) và FE (frontend/src/components/game/sky-themes.ts, copy thủ công vì khác package).
// Không dùng Prisma enum cho field này (xem GameLevel.skyThemeKey trong schema.prisma) — đổi/thêm
// theme mới không cần migration, chỉ cần sửa mảng này + sky-themes.ts.
export const GAME_SKY_THEMES = [
  'clear_day',
  'cave_dim',
  'lava_haze',
  'underwater_teal',
  'underwater_pink',
  'dusk_amber',
  'meadow_warm',
  'cave_pink',
  'desert_heat',
  'cave_purple',
  'magenta_haze',
  'ice_blue',
] as const;

export type GameSkyTheme = (typeof GAME_SKY_THEMES)[number];
