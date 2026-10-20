// Nhân vật người chơi chọn lúc bắt đầu chơi (GamePlayerProgress.characterKey — mirror thủ công của
// enum GameCharacterKey bên backend/prisma/schema.prisma, khác package nên không import thẳng).
// Frame ảnh cắt sẵn từ 2 sprite sheet Viking (rìu/kiếm) bằng scripts/slice-character-sprites.py —
// xem frontend/public/game/characters/<key>/frame-XX.webp. Admin xác nhận đã có quyền dùng asset
// gốc (không phải ảnh watermark/preview chưa mua).
export const GAME_CHARACTERS = [
  {
    key: "VIKING_AXE",
    label: "Chiến binh Rìu",
    frameCount: 10,
    frameUrl: (i: number) => `/game/characters/viking-axe/frame-${String(i).padStart(2, "0")}.webp`,
  },
  {
    key: "VIKING_SWORD",
    label: "Chiến binh Kiếm",
    frameCount: 3,
    frameUrl: (i: number) => `/game/characters/viking-sword/frame-${String(i).padStart(2, "0")}.webp`,
  },
] as const;

export type GameCharacterKey = (typeof GAME_CHARACTERS)[number]["key"];

export function getCharacterConfig(key: GameCharacterKey) {
  return GAME_CHARACTERS.find((c) => c.key === key) ?? GAME_CHARACTERS[0];
}
