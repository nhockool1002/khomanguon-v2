// Quái lang thang gây sát thương khi nhân vật CHẠM VÀO (khác hẳn "monster" kiểu MONSTER_CATCH —
// loại đó cần BẤM để bắt, tính vào điều kiện qua màn; quái ở đây không liên quan điều kiện qua màn,
// chỉ là hiểm hoạ môi trường xuất hiện ở MỌI level). Cắt từ 3 ảnh asset do Admin xác nhận đã có
// quyền dùng — xem scripts/slice-monster-sprites.py. Mỗi sprite là 1 hình tĩnh (không phải chuỗi
// frame đi bộ) — "hiệu ứng chuyển động" tạo bằng code (lắc lư/bay lượn), xem game-engine.ts
// updateHazardMonster().
const PACK_A_COUNT = 20; // frontend/public/game/monsters/pack-a — lưới "MONSTERS OBJECT" ảnh 1
const PACK_B_COUNT = 20; // pack-b — lưới "MONSTERS OBJECT" ảnh 2
const PACK_C_COUNT = 8; // pack-c — ảnh quái tự do trên nền gradient

export const HAZARD_MONSTER_SPRITES: string[] = [
  ...Array.from({ length: PACK_A_COUNT }, (_, i) => `/game/monsters/pack-a/monster-${String(i + 1).padStart(2, "0")}.webp`),
  ...Array.from({ length: PACK_B_COUNT }, (_, i) => `/game/monsters/pack-b/monster-${String(i + 1).padStart(2, "0")}.webp`),
  ...Array.from({ length: PACK_C_COUNT }, (_, i) => `/game/monsters/pack-c/monster-${String(i + 1).padStart(2, "0")}.webp`),
];

export function pickRandomHazardSprites(count: number): string[] {
  const pool = [...HAZARD_MONSTER_SPRITES];
  const picked: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}
