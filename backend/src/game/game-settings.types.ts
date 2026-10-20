// Lưu trong SiteSetting.value (key = GAME_SETTINGS_KEY) — theo đúng pattern key/value chung đã dùng
// cho GeneralSettings/sepay_config (xem settings/site-settings.types.ts), không cần model riêng vì
// chỉ 2 field đơn giản, không cần query/filter theo field này.
//
// HP nhân vật là state CHỈ SỐNG Ở CLIENT trong phiên chơi hiện tại (không lưu GamePlayerProgress) —
// đơn giản hoá cố ý: về 0 máu thì gọi thẳng endpoint reset (dùng lại resetPlayer()), không cần đồng
// bộ currentHp lên server sau mỗi lần trúng đòn. Reload trang giữa chừng sẽ hồi đầy máu — chấp nhận
// được cho tính năng admin-only chưa public.
export const GAME_SETTINGS_KEY = 'game_settings';

export interface GameSettings {
  characterMaxHp: number;
  monsterDamagePerHit: number; // sát thương quái gây cho nhân vật khi CHẠM vào (xem plan trước)
  hazardMonsterHp: number; // máu của quái lang thang — bấm bao nhiêu lần tới lúc hạ gục = hazardMonsterHp / characterAttackDamage
  // Sát thương nhân vật gây cho quái mỗi lần BẤM (khác hẳn monsterDamagePerHit — đây là nhân vật tấn
  // công quái, không phải quái tấn công nhân vật). Hiện là 1 số cố định cấu hình CMS; dự kiến sau này
  // tăng theo vật phẩm trang bị (chưa làm — chỉ đọc 1 điểm duy nhất lúc bấm, xem game-engine.ts
  // damageHazardMonster(), dễ thay nguồn giá trị sau mà không phải sửa logic chỗ khác).
  characterAttackDamage: number;
  // Tỉ lệ loại entity khi spawn quái lang thang mới (xem pickHazardKind() trong game-engine.ts) — 2
  // số này là TRỌNG SỐ tương đối, không bắt buộc cộng = 100 (vd 70/30 hay 7/3 cho kết quả như nhau).
  // hazardMonsterPercent=100, hazardItemPercent=0 (mặc định) giữ nguyên hành vi cũ trước khi có tính
  // năng vật phẩm lang thang — toàn bộ hồ lang thang vẫn là quái thù địch như trước.
  hazardMonsterPercent: number; // % (trọng số) loại "quái" — chạm mất máu, bấm để tấn công/tiêu diệt
  hazardItemPercent: number; // % (trọng số) loại "vật phẩm" — vô hại, bấm để nhặt, hồi 1 ít máu
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  characterMaxHp: 100,
  monsterDamagePerHit: 20,
  hazardMonsterHp: 50,
  characterAttackDamage: 10,
  hazardMonsterPercent: 100,
  hazardItemPercent: 0,
};
