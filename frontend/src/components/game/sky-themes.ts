// Cấu hình bầu trời/thời tiết theo GameLevel.skyThemeKey — mirror thủ công của
// backend/src/game/game.constants.ts (khác package, không import được thẳng). Đổi/thêm theme mới
// thì sửa cả 2 nơi.
export const GAME_SKY_THEMES = [
  "clear_day",
  "cave_dim",
  "lava_haze",
  "underwater_teal",
  "underwater_pink",
  "dusk_amber",
  "meadow_warm",
  "cave_pink",
  "desert_heat",
  "cave_purple",
  "magenta_haze",
  "ice_blue",
] as const;

export type GameSkyTheme = (typeof GAME_SKY_THEMES)[number];

export type ParticleKind = "dust" | "spark" | "ember" | "bubble" | "snow";

// "open" = bầu trời thấy được (ngoài trời) — có mây/sao băng/sao chổi/gió (xem game-engine.ts).
// "enclosed" = hang động/dưới nước — không có khái niệm bầu trời, giữ nguyên hệ particle ambient
// sẵn có (spark/bubble...), chỉ thêm hiệu ứng sáng-tối chu kỳ (áp dụng chung mọi theme).
export type SkyKind = "open" | "enclosed";

export interface SkyThemeConfig {
  label: string;
  skyKind: SkyKind;
  gradientTop: string;
  gradientBottom: string;
  particleKind: ParticleKind;
  particleColor: string;
  particleCount: number;
}

// 1 hàm update/draw particle dùng chung cho cả 12 theme (switch theo particleKind, 5 kind) —
// xem game-engine.ts updateParticle()/drawParticle().
export const SKY_THEME_CONFIG: Record<GameSkyTheme, SkyThemeConfig> = {
  clear_day: {
    label: "Ban ngày trong lành",
    skyKind: "open",
    gradientTop: "#7dd3fc",
    gradientBottom: "#fef3c7",
    particleKind: "dust",
    particleColor: "#ffffff",
    particleCount: 8,
  },
  cave_dim: {
    label: "Hang tối mờ",
    skyKind: "enclosed",
    gradientTop: "#0d0d14",
    gradientBottom: "#262b38",
    particleKind: "spark",
    particleColor: "#8b93a7",
    particleCount: 10,
  },
  lava_haze: {
    label: "Hơi nóng dung nham",
    skyKind: "open",
    gradientTop: "#3b0d0d",
    gradientBottom: "#c2410c",
    particleKind: "ember",
    particleColor: "#fb923c",
    particleCount: 12,
  },
  underwater_teal: {
    label: "Dưới nước xanh ngọc",
    skyKind: "enclosed",
    gradientTop: "#013a3f",
    gradientBottom: "#0f766e",
    particleKind: "bubble",
    particleColor: "#99f6e4",
    particleCount: 12,
  },
  underwater_pink: {
    label: "Dưới nước hồng san hô",
    skyKind: "enclosed",
    gradientTop: "#4a044e",
    gradientBottom: "#db2777",
    particleKind: "bubble",
    particleColor: "#fbcfe8",
    particleCount: 12,
  },
  dusk_amber: {
    label: "Hoàng hôn hổ phách",
    skyKind: "open",
    gradientTop: "#78350f",
    gradientBottom: "#f59e0b",
    particleKind: "dust",
    particleColor: "#fde68a",
    particleCount: 8,
  },
  meadow_warm: {
    label: "Chiều ấm đồng hoa",
    skyKind: "open",
    gradientTop: "#7dd3fc",
    gradientBottom: "#fef9c3",
    particleKind: "dust",
    particleColor: "#ffffff",
    particleCount: 7,
  },
  cave_pink: {
    label: "Hang tím hồng",
    skyKind: "enclosed",
    gradientTop: "#2e1065",
    gradientBottom: "#831843",
    particleKind: "spark",
    particleColor: "#f9a8d4",
    particleCount: 10,
  },
  desert_heat: {
    label: "Nắng nóng sa mạc",
    skyKind: "open",
    gradientTop: "#9a3412",
    gradientBottom: "#fbbf24",
    particleKind: "dust",
    particleColor: "#fde68a",
    particleCount: 10,
  },
  cave_purple: {
    label: "Hang pha lê tím",
    skyKind: "enclosed",
    gradientTop: "#1e1033",
    gradientBottom: "#4c1d95",
    particleKind: "spark",
    particleColor: "#c4b5fd",
    particleCount: 10,
  },
  magenta_haze: {
    label: "Hơi nóng hồng cánh sen",
    skyKind: "open",
    gradientTop: "#4a044e",
    gradientBottom: "#be185d",
    particleKind: "ember",
    particleColor: "#f472b6",
    particleCount: 12,
  },
  ice_blue: {
    label: "Băng giá trong xanh",
    skyKind: "open",
    gradientTop: "#bae6fd",
    gradientBottom: "#f0f9ff",
    particleKind: "snow",
    particleColor: "#ffffff",
    particleCount: 14,
  },
};

export const WIN_CONDITION_LABELS: Record<"ITEM_COLLECT" | "MONSTER_CATCH", string> = {
  ITEM_COLLECT: "Nhặt vật phẩm",
  MONSTER_CATCH: "Bắt quái",
};
