// Logic thuần của game loop — không React/DOM (chỉ nhận CanvasRenderingContext2D được truyền vào
// để vẽ, không tự query DOM). GameCanvas.tsx sở hữu canvas ref/effect/requestAnimationFrame, gọi
// vào đây mỗi frame.
import type { GameLevel } from "@/lib/types";
import { SKY_THEME_CONFIG, type GameSkyTheme, type ParticleKind } from "./sky-themes";

export const HIT_RADIUS = 26;
const POP_DURATION_MS = 180;
const ENTITY_MARGIN = 36;

// Nhân vật không tự chạy nữa — người chơi giữ phím để di chuyển (xem GameCanvas.tsx handleKeyDown/Up),
// lùi được nhưng giới hạn khoảng cách tính từ điểm xa nhất đã tới (maxScrollX trong GameEngineState).
// "1 bước" quy ước = STEP_PX — không có đơn vị "bước" chuẩn nào khác trong game này nên tự chọn mốc
// hợp lý (gần với sải chân hoạt ảnh đi bộ) để quy đổi "~100 bước" thành khoảng cách pixel cụ thể.
const STEP_PX = 8;
const MAX_BACKTRACK_STEPS = 100;
const MAX_BACKTRACK_PX = STEP_PX * MAX_BACKTRACK_STEPS; // 800px — lùi được gần 1 màn hình (960px logic)

const DAY_NIGHT_CYCLE_S = 50; // 1 vòng sáng→tối→sáng mất 50s — đủ chậm để không gây chú ý như hiệu ứng nhấp nháy
const NIGHT_DARKEN_MAX = 0.55; // tối đa làm tối gradient bầu trời lúc "đêm" nhất — không cho về đen hẳn, vẫn nhìn rõ map
const CLOUD_COUNT = 5;
const CLOUD_WRAP_MARGIN = 140; // bề rộng ước lượng 1 cụm mây — dùng để biết lúc nào trôi hết màn hình mà respawn lại bên phải
const WIND_SPEED_PXS = 650; // vệt gió lướt nhanh hơn hẳn mọi thứ khác trên màn hình — mô phỏng gió giật

// Vị trí neo nhân vật trên màn hình (tỉ lệ % chiều rộng/cao canvas) — dùng chung giữa
// drawCharacterSprite (vẽ) và hit-test va chạm quái lang thang (updateEngine), tách hằng số ra đây
// để 2 nơi không bao giờ lệch nhau.
const CHAR_ORIGIN_X_RATIO = 0.18;
const CHAR_GROUND_Y_RATIO = 0.78;
const CHAR_DISPLAY_HEIGHT = 96; // chiều cao hiển thị trong canvas (px logic) — frame co giãn theo tỉ lệ gốc

// ───────────────────────── Quái lang thang (hazard monster) ─────────────────────────
// Khác hẳn GameEntity (item/monster kiểu MONSTER_CATCH — bấm để bắt, tính vào điều kiện qua màn).
// Quái ở đây CHẠM vào là mất máu, xuất hiện ở MỌI level không phân biệt winConditionType, không
// liên quan tiến độ qua màn — thuần là hiểm hoạ môi trường lượn lờ quanh người chơi.
export const HAZARD_COUNT = 4;
const HAZARD_COLLISION_RADIUS = 30;
const HAZARD_INVINCIBLE_MS = 2000;
const HAZARD_DISPLAY_SIZE = 56; // kích thước hiển thị (cạnh dài nhất), sprite có tỉ lệ khung khác nhau nên co theo chiều lớn hơn
const HAZARD_BOB_RANGE = 10;
const HAZARD_WANDER_RANGE = 50;
const HAZARD_RESPAWN_MARGIN = 220; // home trôi quá xa 2 bên màn hình thì dời về gần người chơi lại

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// 0 = sáng nhất, 1 = tối nhất — dùng cos để pha=0 luôn bắt đầu ở trạng thái sáng, mượt dần qua tối
// rồi sáng lại (không giật cấp như toggle tuyến tính thẳng).
function getNightFactor(state: GameEngineState): number {
  return (1 - Math.cos(state.dayNightPhase * Math.PI * 2)) / 2;
}

// Làm tối 1 màu hex theo tỉ lệ amount (0 = giữ nguyên, 1 = về đen) — dùng cho gradient bầu trời lúc
// ban đêm, không cần thêm layer overlay riêng (đỡ 1 lượt vẽ full-canvas mỗi frame).
function darkenHexColor(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const f = 1 - amount;
  return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
}

const COMET_HEAD_COLOR = "#e0f2fe";
const STAR_HEAD_COLOR = "#ffffff";

function spawnSkyStreak(canvasW: number, canvasH: number, isComet: boolean): SkyStreak {
  const startX = canvasW * (0.5 + Math.random() * 0.5); // xuất phát nửa phải màn hình, bay chéo xuống-trái
  const startY = canvasH * (Math.random() * 0.3);
  if (isComet) {
    return {
      x: startX,
      y: startY,
      vx: -(120 + Math.random() * 60),
      vy: 40 + Math.random() * 30,
      ageMs: 0,
      lifeMs: 2800 + Math.random() * 1200,
      length: 90 + Math.random() * 40,
      isComet: true,
    };
  }
  return {
    x: startX,
    y: startY,
    vx: -(500 + Math.random() * 250),
    vy: 180 + Math.random() * 120,
    ageMs: 0,
    lifeMs: 450 + Math.random() * 200,
    length: 55 + Math.random() * 30,
    isComet: false,
  };
}

function updateSkyStreaks(streaks: SkyStreak[], dtMs: number, dtS: number): void {
  for (const s of streaks) {
    s.x += s.vx * dtS;
    s.y += s.vy * dtS;
    s.ageMs += dtMs;
  }
  // mutate-in-place qua splice thay vì reassign mảng mới — streaks hiếm khi đông, không đáng ngại hiệu năng
  for (let i = streaks.length - 1; i >= 0; i--) {
    if (streaks[i].ageMs >= streaks[i].lifeMs) streaks.splice(i, 1);
  }
}

// 1 "cơn gió" = nhiều vệt kẻ song song xuất hiện cùng lúc ở các độ cao khác nhau trong dải trời
// trên-giữa, cùng lướt rất nhanh rồi biến mất — xem WIND_SPEED_PXS.
function spawnWindGust(state: GameEngineState, canvasW: number, canvasH: number): void {
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    state.windStreaks.push({
      x: canvasW + Math.random() * 100,
      y: canvasH * (0.08 + Math.random() * 0.35),
      length: 50 + Math.random() * 70,
      ageMs: 0,
      lifeMs: 350 + Math.random() * 250,
      opacity: 0.15 + Math.random() * 0.2,
    });
  }
}

// worldX (KHÔNG phải toạ độ màn hình) — cố định tại thời điểm spawn, không đổi theo thời gian. Toạ
// độ vẽ/hit-test thực tế = worldX - state.scrollX, tính lại mỗi frame. Bắt buộc dùng toạ độ thế giới
// cố định (thay vì cộng dồn vận tốc mỗi frame như bản auto-run cũ) vì giờ người chơi có thể lùi —
// nếu entity tự trừ dần theo thời gian thì lùi lại sẽ không thấy đúng vị trí cũ của nó.
export interface GameEntity {
  id: number;
  kind: "item" | "monster";
  worldX: number;
  y: number;
  collected: boolean;
  poppingUntil: number | null; // state.elapsedMs lúc hết hiệu ứng "pop", null = chưa bấm
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
}

// Mây trôi chậm — lớp "xa" riêng, trôi độc lập với scrollX (không cuộn theo nền) để tạo cảm giác xa
// gần (parallax), chỉ bật cho theme skyKind="open" (ngoài trời). Mỗi cụm mây vẽ từ vài hình ellipse
// chồng nhau (xem drawClouds).
interface Cloud {
  x: number;
  y: number;
  scale: number;
  speedPxS: number;
  opacity: number;
}

// Dùng chung cho sao băng + sao chổi — khác nhau ở kích thước/tốc độ/thời lượng/có glow hay không
// (xem spawnSkyStreak, drawSkyStreaks). Vệt sáng, không phải vật thể va chạm được.
interface SkyStreak {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
  lifeMs: number;
  length: number;
  isComet: boolean;
}

// Vệt gió — vài đường kẻ mảnh bán trong suốt lướt nhanh ngang trời, xuất hiện theo "cơn" (nhiều vệt
// cùng lúc) rồi biến mất, gợi cảm giác gió thổi qua chứ không phải vật thể thật.
interface WindStreak {
  x: number;
  y: number;
  length: number;
  ageMs: number;
  lifeMs: number;
  opacity: number;
}

// Mảnh vỡ văng ra lúc quái bị hạ gục — tạo 1 lần lúc bắt đầu hiệu ứng chết, KHÔNG phải particle hệ
// thống dùng chung (xem Particle) vì chỉ sống trong đúng DEATH_ANIM_MS rồi bỏ cùng quái, không cần
// wrap/tái sinh như particle nền.
interface DeathDebris {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// Quái lang thang — worldX là tâm vùng "nhà" (home), vị trí hiển thị thực tế lắc quanh home theo
// wanderPhase (ngang) + bobPhase (dọc), KHÔNG đứng yên 1 chỗ (đáp ứng yêu cầu "thêm hiệu ứng chuyển
// động"). imageIndex trỏ vào mảng ảnh đã preload ở GameCanvas.tsx (xem hazard-monsters.ts).
//
// hp/maxHp: bấm (không phải chạm) để gây sát thương — xem damageHazardMonster(). hp < maxHp mới hiện
// thanh máu nhỏ phía trên (coi như đã "focus" vào quái đó, xem drawHazardMonsters). dyingUntil khác
// null nghĩa là đã hết máu, đang chạy hiệu ứng biến mất (DEATH_ANIM_MS) — lúc này KHÔNG còn gây sát
// thương khi chạm, KHÔNG nhận thêm đòn tấn công nào (xem updateEngine).
// kind="item": biến thể vô hại của hồ lang thang — không gây sát thương khi chạm, bấm để NHẶT (hồi 1
// ít máu) thay vì tấn công. hp/maxHp vẫn có nhưng không dùng tới cho item (luôn nhặt xong trong 1 lần
// bấm, xem collectHazardItem) — giữ chung 1 interface để tái dùng toàn bộ cơ chế lắc lư/respawn/hiệu
// ứng chết đã có cho cả 2 loại, tránh trùng lặp state.
export interface HazardMonster {
  id: number;
  kind: "monster" | "item";
  imageIndex: number;
  homeWorldX: number;
  baseY: number;
  bobPhase: number;
  wanderPhase: number;
  hp: number;
  maxHp: number;
  dyingUntil: number | null;
  deathDebris: DeathDebris[] | null;
}

export interface GameEngineState {
  levelId: string;
  elapsedMs: number;
  scrollX: number;
  maxScrollX: number; // điểm xa nhất đã đi tới — giới hạn lùi tính từ đây, không phải từ scrollX hiện tại
  nextSpawnWorldX: number; // spawn entity khi scrollX (tiến LÊN) chạm mốc này — theo quãng đường, không theo thời gian
  nextEntityId: number;
  entities: GameEntity[];
  particles: Particle[];
  collectedCount: number;
  completedFired: boolean;
  characterWalkPhase: number;
  facingDirection: 1 | -1; // 1 = quay phải (hướng gốc của sprite), -1 = quay trái (lùi) — xem drawCharacterSprite
  dayNightPhase: number; // 0..1 lặp vòng — xem DAY_NIGHT_CYCLE_S
  clouds: Cloud[];
  shootingStars: SkyStreak[];
  comets: SkyStreak[];
  windStreaks: WindStreak[];
  shootingStarTimerMs: number;
  cometTimerMs: number;
  windTimerMs: number;
  hazardMonsters: HazardMonster[];
  hazardImageCount: number; // lưu lại để spawn quái thay thế lúc 1 con bị hạ gục (xem updateEngine)
  hazardMonsterHp: number; // máu mặc định khi spawn quái mới — đọc từ GameSettings lúc tạo state, xem createEngineState
  hazardMonsterPercent: number; // trọng số loại "monster" lúc spawn/respawn — xem pickHazardKind
  hazardItemPercent: number; // trọng số loại "item" lúc spawn/respawn — xem pickHazardKind
  nextHazardId: number;
  hp: number;
  maxHp: number;
  invincibleUntilMs: number | null; // elapsedMs lúc hết tàng hình — null = không đang tàng hình
  justTookDamage: boolean; // true đúng 1 frame lúc vừa trúng đòn — GameCanvas đọc rồi tự xoá cờ
  // Khác justTookDamage: KHÔNG tự reset trong updateEngine (nhặt item xảy ra ở pointerdown, ngoài vòng
  // lặp rAF) — GameCanvas tự đọc rồi tự xoá cờ này sau khi xử lý (xem frame() trong GameCanvas.tsx).
  justHealed: boolean;
}

function createCloud(canvasW: number, canvasH: number, startX?: number): Cloud {
  return {
    x: startX ?? Math.random() * canvasW,
    y: canvasH * (0.05 + Math.random() * 0.3),
    scale: 0.6 + Math.random() * 0.7,
    speedPxS: 6 + Math.random() * 10, // chậm hơn hẳn nền (scrollSpeedPxS thường >=20) — cảm giác mây ở xa
    opacity: 0.5 + Math.random() * 0.35,
  };
}

// Quy đổi "Nhịp xuất hiện (ms)" (cấu hình ở trang Cài đặt Game, vốn tính cho model auto-run cũ)
// sang khoảng cách THẾ GIỚI giữa 2 lần spawn liên tiếp, dựa trên tốc độ cuộn cấu hình của level —
// giữ đúng mật độ item/quái mà Admin đã cân chỉnh, chỉ đổi mốc tính từ "theo thời gian" (giây) sang
// "theo quãng đường đã đi" (px) để khớp cơ chế di chuyển chủ động mới (đứng yên thì không tự spawn
// dồn cục — xem updateEngine).
function spawnDistancePx(level: GameLevel): number {
  return level.scrollSpeedPxS * (level.spawnIntervalMs / 1000);
}

// Trọng số tương đối — KHÔNG bắt buộc cộng = 100 (vd 70/30 hay 7/3 ra cùng tỉ lệ). Cả 2 = 0 (Admin
// chưa cấu hình gì, hoặc lỡ tay nhập 0/0) thì fallback về "monster" — giữ đúng hành vi cũ trước khi
// có tính năng này thay vì chia 0 cho NaN.
function pickHazardKind(monsterPercent: number, itemPercent: number): "monster" | "item" {
  const total = monsterPercent + itemPercent;
  if (total <= 0) return "monster";
  return Math.random() * total < monsterPercent ? "monster" : "item";
}

function createHazardMonster(
  id: number,
  imageCount: number,
  hazardMonsterHp: number,
  canvasW: number,
  canvasH: number,
  hazardMonsterPercent: number,
  hazardItemPercent: number,
): HazardMonster {
  return {
    id,
    kind: pickHazardKind(hazardMonsterPercent, hazardItemPercent),
    // Random thay vì id % imageCount — spawn lại lúc hạ gục 1 con cũng ra sprite khác liền kề thay
    // vì luôn lặp lại đúng cùng 1 sprite cho cùng vị trí trong mảng (xem respawn trong updateEngine).
    imageIndex: imageCount > 0 ? Math.floor(Math.random() * imageCount) : 0,
    homeWorldX: Math.random() * canvasW,
    baseY: canvasH * (0.3 + Math.random() * 0.4),
    bobPhase: Math.random() * Math.PI * 2,
    wanderPhase: Math.random() * Math.PI * 2,
    hp: hazardMonsterHp,
    maxHp: hazardMonsterHp,
    dyingUntil: null,
    deathDebris: null,
  };
}

// maxHp/hazardImageCount/hazardMonsterHp/hazardMonsterPercent/hazardItemPercent truyền từ GameSettings
// (BE) + số ảnh quái đã preload ở GameCanvas.tsx — engine không tự biết mặc định, luôn phải truyền
// vào từ nơi gọi để không lệch với cấu hình CMS.
export function createEngineState(
  level: GameLevel,
  canvasW: number,
  canvasH: number,
  maxHp: number,
  hazardImageCount: number,
  hazardMonsterHp: number,
  hazardMonsterPercent: number,
  hazardItemPercent: number,
): GameEngineState {
  const theme = SKY_THEME_CONFIG[level.skyThemeKey as GameSkyTheme] ?? SKY_THEME_CONFIG.clear_day;
  const particles: Particle[] = Array.from({ length: theme.particleCount }, () => ({
    x: Math.random() * canvasW,
    y: Math.random() * canvasH * 0.7,
    vx: (Math.random() - 0.5) * 10,
    vy: -5 - Math.random() * 15,
    size: 2 + Math.random() * 3,
    alpha: 0.4 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
  }));
  const clouds: Cloud[] =
    theme.skyKind === "open"
      ? Array.from({ length: CLOUD_COUNT }, () => createCloud(canvasW, canvasH))
      : [];
  const hazardMonsters: HazardMonster[] = Array.from({ length: HAZARD_COUNT }, (_, i) =>
    createHazardMonster(i, hazardImageCount, hazardMonsterHp, canvasW, canvasH, hazardMonsterPercent, hazardItemPercent),
  );

  return {
    levelId: level.id,
    elapsedMs: 0,
    scrollX: 0,
    maxScrollX: 0,
    nextSpawnWorldX: spawnDistancePx(level),
    nextEntityId: 1,
    entities: [],
    particles,
    collectedCount: 0,
    completedFired: false,
    characterWalkPhase: 0,
    facingDirection: 1,
    dayNightPhase: Math.random(), // lệch pha ngẫu nhiên giữa các lượt chơi, không đồng bộ cứng nhắc
    clouds,
    shootingStars: [],
    comets: [],
    windStreaks: [],
    shootingStarTimerMs: 2000 + Math.random() * 3000,
    cometTimerMs: 8000 + Math.random() * 10000,
    windTimerMs: 3000 + Math.random() * 4000,
    hazardMonsters,
    hazardImageCount,
    hazardMonsterHp,
    hazardMonsterPercent,
    hazardItemPercent,
    nextHazardId: HAZARD_COUNT,
    hp: maxHp,
    maxHp,
    invincibleUntilMs: null,
    justTookDamage: false,
    justHealed: false,
  };
}

function updateParticle(p: Particle, kind: ParticleKind, dtS: number, w: number, h: number): void {
  p.phase += dtS;
  switch (kind) {
    case "bubble":
    case "snow":
    case "ember":
      p.y += p.vy * dtS;
      p.x += Math.sin(p.phase * 2) * 6 * dtS;
      break;
    default: // "dust" | "spark" — trôi ngang nhẹ, gần như lơ lửng
      p.x += p.vx * dtS;
      p.y += Math.sin(p.phase) * 4 * dtS;
  }
  // wrap quanh canvas — bubble/ember bay lên nên wrap theo trục y ngược (lên hết thì quay xuống đáy)
  if (p.y < -10) p.y = h + 10;
  if (p.y > h + 10) p.y = -10;
  if (p.x < -10) p.x = w + 10;
  if (p.x > w + 10) p.x = -10;
}

// direction: -1 (lùi) | 0 (đứng yên) | 1 (tiến) — GameCanvas.tsx tính từ phím đang giữ
// (ArrowRight/D = tiến, ArrowLeft/A = lùi; giữ cả 2 coi như 0, xem handleKeyDown/Up).
export function updateEngine(
  state: GameEngineState,
  dtMs: number,
  level: GameLevel,
  canvasW: number,
  canvasH: number,
  direction: -1 | 0 | 1,
  damagePerHit: number,
): void {
  const dtS = dtMs / 1000;
  state.elapsedMs += dtMs;
  state.justTookDamage = false;

  // Nhân vật không tự chạy nữa — chỉ cuộn khi người chơi đang giữ phím. Tiến thì không giới hạn,
  // lùi thì kẹp lại không cho vượt quá MAX_BACKTRACK_PX tính từ điểm xa nhất đã từng tới
  // (maxScrollX, không phải từ scrollX hiện tại — nếu không giới hạn sẽ "trượt" dần mỗi lần đổi
  // hướng liên tục thay vì cố định theo đúng 1 mốc).
  if (direction !== 0) {
    state.scrollX += direction * level.scrollSpeedPxS * dtS;
    // maxScrollX cập nhật TRƯỚC khi kẹp — nên sau dòng này scrollX luôn <= maxScrollX đương nhiên,
    // chỉ cần kẹp biên dưới (không lùi quá xa).
    state.maxScrollX = Math.max(state.maxScrollX, state.scrollX);
    const minScrollX = Math.max(0, state.maxScrollX - MAX_BACKTRACK_PX);
    state.scrollX = Math.max(state.scrollX, minScrollX);

    // Quay mặt theo hướng đang đi — giữ nguyên hướng cũ lúc đứng yên (direction=0 không vào nhánh
    // này), không tự quay về phải mỗi khi buông phím. Sprite gốc vẽ quay phải nên facingDirection=1
    // vẽ thẳng, =-1 lật ngang (xem drawCharacterSprite).
    state.facingDirection = direction;

    // Nhịp vung chân/tay — chỉ chạy khi thực sự đang di chuyển (giữ phím), đứng yên thì đứng hình
    // nguyên dáng hiện tại (không có thành phần nào cộng vào trục y — xem drawCharacterSprite).
    state.characterWalkPhase += dtS * (level.scrollSpeedPxS / 20);
  }

  const theme = SKY_THEME_CONFIG[level.skyThemeKey as GameSkyTheme] ?? SKY_THEME_CONFIG.clear_day;
  for (const p of state.particles) updateParticle(p, theme.particleKind, dtS, canvasW, canvasH);

  // Chu kỳ sáng-tối — áp dụng mọi theme (kể cả hang/dưới nước, ánh sáng môi trường vẫn đổi nhẹ theo
  // chu kỳ cho sống động), chỉ gradient bầu trời là bị làm tối dần (xem drawSky getNightFactor()).
  state.dayNightPhase += dtS / DAY_NIGHT_CYCLE_S;
  if (state.dayNightPhase >= 1) state.dayNightPhase -= 1;

  if (theme.skyKind === "open") {
    const nightFactor = getNightFactor(state);
    for (const c of state.clouds) {
      c.x -= c.speedPxS * dtS;
      if (c.x < -CLOUD_WRAP_MARGIN) {
        Object.assign(c, createCloud(canvasW, canvasH, canvasW + CLOUD_WRAP_MARGIN * 0.5));
      }
    }

    // Sao băng/sao chổi thưa hơn hẳn lúc trời sáng, dày hơn lúc "đêm" (nightFactor cao) — nội suy
    // tuyến tính khoảng thời gian chờ theo nightFactor thay vì bật/tắt cứng, mượt hơn qua chu kỳ.
    state.shootingStarTimerMs -= dtMs;
    if (state.shootingStarTimerMs <= 0) {
      state.shootingStars.push(spawnSkyStreak(canvasW, canvasH, false));
      state.shootingStarTimerMs = lerp(11000, 2500, nightFactor) + Math.random() * 2000;
    }
    state.cometTimerMs -= dtMs;
    if (state.cometTimerMs <= 0) {
      state.comets.push(spawnSkyStreak(canvasW, canvasH, true));
      state.cometTimerMs = lerp(30000, 10000, nightFactor) + Math.random() * 8000;
    }
    updateSkyStreaks(state.shootingStars, dtMs, dtS);
    updateSkyStreaks(state.comets, dtMs, dtS);

    state.windTimerMs -= dtMs;
    if (state.windTimerMs <= 0) {
      spawnWindGust(state, canvasW, canvasH);
      state.windTimerMs = 4000 + Math.random() * 5000;
    }
    for (const ws of state.windStreaks) {
      ws.x -= WIND_SPEED_PXS * dtS;
      ws.ageMs += dtMs;
    }
    state.windStreaks = state.windStreaks.filter((ws) => ws.ageMs < ws.lifeMs);
  }

  // Spawn theo QUÃNG ĐƯỜNG đã tiến (scrollX vượt mốc nextSpawnWorldX), không theo thời gian — đứng
  // yên hoặc lùi thì không tự sinh thêm entity dồn cục tại cùng 1 toạ độ thế giới (xem spawnDistancePx).
  // Vẫn ngừng hẳn khi đã đủ số lượng cần, chờ GameCanvas báo onLevelComplete.
  if (state.collectedCount < level.targetCount && state.scrollX >= state.nextSpawnWorldX) {
    state.nextSpawnWorldX = state.scrollX + spawnDistancePx(level);
    const groundY = canvasH * (0.55 + Math.random() * 0.2);
    state.entities.push({
      id: state.nextEntityId++,
      kind: level.winConditionType === "MONSTER_CATCH" ? "monster" : "item",
      worldX: state.scrollX + canvasW + ENTITY_MARGIN,
      y: groundY,
      collected: false,
      poppingUntil: null,
    });
  }

  // Dọn entity: pop hết hiệu ứng thì xoá (như cũ); entity chưa bấm thì chỉ xoá khi CHẮC CHẮN không
  // bao giờ lùi lại thấy được nữa (worldX nằm ngoài tầm lùi tối đa từ maxScrollX, trừ thêm 1 chiều
  // rộng canvas cho an toàn) — khác bản cũ (xoá ngay khi ra khỏi màn hình), vì giờ người chơi lùi
  // được nên vật chưa bấm phải còn "đứng yên tại chỗ" trong suốt phạm vi lùi cho phép.
  const unreachableBefore = state.maxScrollX - MAX_BACKTRACK_PX - canvasW - ENTITY_MARGIN;
  state.entities = state.entities.filter((e) => {
    if (e.collected && e.poppingUntil !== null && state.elapsedMs >= e.poppingUntil) return false;
    if (!e.collected && e.worldX < unreachableBefore) return false;
    return true;
  });

  // Quái lang thang: lắc lư quanh "nhà" (bob dọc + wander ngang), nhà tự dời lại gần người chơi nếu
  // trôi quá xa 2 bên màn hình — luôn hiện diện quanh người chơi bất kể tiến/lùi/đứng yên, không
  // "hết hạn" như entity thường. Quái ĐANG chết (dyingUntil khác null) thì đứng yên tại chỗ bị hạ —
  // không tiếp tục lắc lư, chỉ chạy debris văng ra (xem drawHazardMonsters).
  for (const m of state.hazardMonsters) {
    if (m.dyingUntil !== null) {
      if (m.deathDebris) {
        for (const d of m.deathDebris) {
          d.x += d.vx * dtS;
          d.y += d.vy * dtS;
          d.vy += 260 * dtS; // trọng lực nhẹ — mảnh vỡ rơi xuống thay vì bay thẳng mãi
        }
      }
      continue;
    }
    m.bobPhase += dtS * 1.6;
    m.wanderPhase += dtS * 0.8;
    const homeScreenX = m.homeWorldX - state.scrollX;
    if (homeScreenX < -HAZARD_RESPAWN_MARGIN || homeScreenX > canvasW + HAZARD_RESPAWN_MARGIN) {
      m.homeWorldX = state.scrollX + Math.random() * canvasW;
      m.baseY = canvasH * (0.3 + Math.random() * 0.4);
    }
  }

  // Quái chết đã chạy hết hiệu ứng (DEATH_ANIM_MS) — xoá rồi spawn NGAY 1 con thay thế (vị trí/sprite
  // mới hoàn toàn, máu đầy) để luôn duy trì đúng HAZARD_COUNT con lượn quanh người chơi, không cạn dần.
  state.hazardMonsters = state.hazardMonsters.map((m) => {
    if (m.dyingUntil !== null && state.elapsedMs >= m.dyingUntil) {
      return createHazardMonster(
        state.nextHazardId++,
        state.hazardImageCount,
        state.hazardMonsterHp,
        canvasW,
        canvasH,
        state.hazardMonsterPercent,
        state.hazardItemPercent,
      );
    }
    return m;
  });

  // Hết hạn tàng hình thì xoá mốc NGAY (về null) thay vì để timestamp cũ trong quá khứ — isInvincible
  // ở dưới (và cả nơi khác muốn biết trạng thái tàng hình, vd lúc vẽ nhân vật nhấp nháy) chỉ cần so
  // null-check đơn giản, không phải nhớ so thêm elapsedMs mỗi nơi dùng.
  if (state.invincibleUntilMs !== null && state.elapsedMs >= state.invincibleUntilMs) {
    state.invincibleUntilMs = null;
  }

  // Va chạm: nhân vật đứng cố định ở (originX, groundY) trên màn hình — so khoảng cách tới từng quái
  // đã tính toạ độ màn hình thực (home + lắc lư). Đang tàng hình thì bỏ qua hoàn toàn, không cộng dồn
  // sát thương dù đứng giữa nhiều quái cùng lúc. Quái ĐANG chết thì bỏ qua — đã bị hạ, không còn gây
  // sát thương khi chạm vào xác đang biến mất.
  if (state.invincibleUntilMs === null) {
    const charX = canvasW * CHAR_ORIGIN_X_RATIO;
    const charY = canvasH * CHAR_GROUND_Y_RATIO - CHAR_DISPLAY_HEIGHT / 2;
    for (const m of state.hazardMonsters) {
      if (m.dyingUntil !== null) continue;
      if (m.kind !== "monster") continue; // item vô hại — không gây sát thương khi chạm
      const { x: mx, y: my } = getHazardScreenPos(m, state.scrollX);
      if (Math.hypot(mx - charX, my - charY) <= HAZARD_COLLISION_RADIUS) {
        state.hp = Math.max(0, state.hp - damagePerHit);
        state.invincibleUntilMs = state.elapsedMs + HAZARD_INVINCIBLE_MS;
        state.justTookDamage = true;
        break; // 1 lần chạm chỉ trừ 1 lần máu dù đứng cạnh nhiều quái cùng lúc
      }
    }
  }
}

function getHazardScreenPos(m: HazardMonster, scrollX: number): { x: number; y: number } {
  return {
    x: m.homeWorldX - scrollX + Math.sin(m.wanderPhase) * HAZARD_WANDER_RANGE,
    y: m.baseY + Math.sin(m.bobPhase) * HAZARD_BOB_RANGE,
  };
}

// Trả quái lang thang gần nhất trong bán kính HAZARD_COLLISION_RADIUS tại toạ độ canvas logic (x,y)
// — dùng cho click/chạm tấn công (xem damageHazardMonster), KHÔNG tính quái đang chết (đã hạ gục,
// không bấm thêm được nữa) để tránh bấm trúng xác đang biến mất mà không có phản hồi gì.
export function hitTestHazardMonster(state: GameEngineState, x: number, y: number): HazardMonster | null {
  let closest: HazardMonster | null = null;
  let closestDist = HAZARD_COLLISION_RADIUS;
  for (const m of state.hazardMonsters) {
    if (m.dyingUntil !== null) continue;
    const { x: mx, y: my } = getHazardScreenPos(m, state.scrollX);
    const dist = Math.hypot(mx - x, my - y);
    if (dist <= closestDist) {
      closest = m;
      closestDist = dist;
    }
  }
  return closest;
}

const DEATH_ANIM_MS = 450;
const DEATH_DEBRIS_COUNT = 8;
// Hồi máu cố định mỗi lần nhặt 1 vật phẩm lang thang — không cấu hình CMS (chưa có yêu cầu riêng cho
// lượng hồi), chỉ số lượng/tỉ lệ xuất hiện item mới cấu hình được (xem hazardItemPercent).
const HAZARD_ITEM_HEAL_AMOUNT = 15;

// Bấm trúng quái — trừ máu theo sát thương hiện tại của nhân vật (characterAttackDamage, đọc 1 lần
// tại đây — xem ghi chú "tăng theo vật phẩm sau này" trong GameSettings). Hết máu thì KHÔNG xoá
// ngay, chuyển sang trạng thái "đang chết" DEATH_ANIM_MS rồi mới thực sự biến mất + spawn quái mới
// thay thế (xem updateEngine) — đáp ứng yêu cầu "có hiệu ứng rồi mới biến mất".
export function damageHazardMonster(state: GameEngineState, monster: HazardMonster, amount: number): void {
  if (monster.dyingUntil !== null) return;
  monster.hp = Math.max(0, monster.hp - amount);
  if (monster.hp > 0) return;

  monster.dyingUntil = state.elapsedMs + DEATH_ANIM_MS;
  const { x, y } = getHazardScreenPos(monster, state.scrollX);
  monster.deathDebris = Array.from({ length: DEATH_DEBRIS_COUNT }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 90;
    return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 40 };
  });
}

// Bấm trúng vật phẩm lang thang (kind="item") — khác hẳn damageHazardMonster: luôn nhặt xong ngay
// trong 1 lần bấm (không có khái niệm máu/nhiều lần bấm cho item), hồi máu cố định thay vì gây sát
// thương. Dùng chung hiệu ứng "chết" (pop + debris) với quái cho nhất quán hình ảnh lúc biến mất.
export function collectHazardItem(state: GameEngineState, item: HazardMonster): void {
  if (item.dyingUntil !== null) return;
  state.hp = Math.min(state.maxHp, state.hp + HAZARD_ITEM_HEAL_AMOUNT);
  state.justHealed = true;

  item.dyingUntil = state.elapsedMs + DEATH_ANIM_MS;
  const { x, y } = getHazardScreenPos(item, state.scrollX);
  item.deathDebris = Array.from({ length: DEATH_DEBRIS_COUNT }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 90;
    return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 40 };
  });
}

// Trả entity gần nhất trong bán kính HIT_RADIUS tại toạ độ canvas logic (x,y), hoặc null.
export function hitTestEntity(state: GameEngineState, x: number, y: number): GameEntity | null {
  let closest: GameEntity | null = null;
  let closestDist = HIT_RADIUS;
  for (const e of state.entities) {
    if (e.collected) continue;
    const screenX = e.worldX - state.scrollX;
    const dist = Math.hypot(screenX - x, e.y - y);
    if (dist <= closestDist) {
      closest = e;
      closestDist = dist;
    }
  }
  return closest;
}

export function collectEntity(state: GameEngineState, entity: GameEntity): void {
  entity.collected = true;
  entity.poppingUntil = state.elapsedMs + POP_DURATION_MS;
  state.collectedCount += 1;
}

// ───────────────────────── Vẽ ─────────────────────────

// state tuỳ chọn — truyền vào để áp hiệu ứng sáng-tối theo chu kỳ (xem getNightFactor). Không truyền
// (hoặc gọi nơi khác chưa có state, vd preview tĩnh) thì vẽ gradient gốc, không tối đi.
export function drawSky(
  ctx: CanvasRenderingContext2D,
  level: GameLevel,
  w: number,
  h: number,
  state?: GameEngineState,
): void {
  const theme = SKY_THEME_CONFIG[level.skyThemeKey as GameSkyTheme] ?? SKY_THEME_CONFIG.clear_day;
  const darken = state ? getNightFactor(state) * NIGHT_DARKEN_MAX : 0;
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, darken > 0 ? darkenHexColor(theme.gradientTop, darken) : theme.gradientTop);
  gradient.addColorStop(1, darken > 0 ? darkenHexColor(theme.gradientBottom, darken) : theme.gradientBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function drawCloudShape(ctx: CanvasRenderingContext2D, c: Cloud, opacityMul: number): void {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(c.scale, c.scale);
  ctx.globalAlpha = c.opacity * opacityMul;
  ctx.fillStyle = "#ffffff";
  // Cụm 4 hình ellipse chồng nhau tạo dáng mây bồng — đơn giản nhưng đủ nhận ra là mây ở kích thước nhỏ.
  const puffs: Array<[number, number, number, number]> = [
    [0, 0, 26, 16],
    [20, -6, 20, 14],
    [-20, -4, 18, 13],
    [6, -14, 18, 12],
  ];
  for (const [px, py, rx, ry] of puffs) {
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawClouds(ctx: CanvasRenderingContext2D, state: GameEngineState): void {
  // Ban đêm mây mờ đi 1 chút (không biến mất hẳn) — hợp lý hơn là giữ y hệt độ sáng ban ngày.
  const opacityMul = 1 - getNightFactor(state) * 0.35;
  for (const c of state.clouds) drawCloudShape(ctx, c, opacityMul);
}

function drawSkyStreak(ctx: CanvasRenderingContext2D, s: SkyStreak): void {
  const lifeRatio = 1 - s.ageMs / s.lifeMs; // 1 lúc mới sinh -> 0 lúc sắp biến mất, dùng để fade
  const speed = Math.hypot(s.vx, s.vy) || 1;
  const dirX = s.vx / speed;
  const dirY = s.vy / speed;
  const tailX = s.x - dirX * s.length;
  const tailY = s.y - dirY * s.length;

  const gradient = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
  const headColor = s.isComet ? COMET_HEAD_COLOR : STAR_HEAD_COLOR;
  gradient.addColorStop(0, `${headColor}`);
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, lifeRatio * 1.3));
  ctx.strokeStyle = gradient;
  ctx.lineWidth = s.isComet ? 4 : 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(tailX, tailY);
  ctx.stroke();

  // Đầu sáng rực — sao chổi có thêm quầng sáng (glow) quanh đầu, sao băng chỉ 1 chấm nhỏ gọn.
  if (s.isComet) {
    const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 10);
    glow.addColorStop(0, "rgba(224,242,254,0.9)");
    glow.addColorStop(1, "rgba(224,242,254,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = headColor;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawSkyStreaks(ctx: CanvasRenderingContext2D, state: GameEngineState): void {
  for (const s of state.comets) drawSkyStreak(ctx, s);
  for (const s of state.shootingStars) drawSkyStreak(ctx, s);
}

export function drawWindStreaks(ctx: CanvasRenderingContext2D, state: GameEngineState): void {
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (const ws of state.windStreaks) {
    const lifeRatio = 1 - ws.ageMs / ws.lifeMs;
    ctx.globalAlpha = ws.opacity * Math.max(0, lifeRatio);
    ctx.beginPath();
    ctx.moveTo(ws.x, ws.y);
    ctx.lineTo(ws.x - ws.length, ws.y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, kind: ParticleKind, color: string): void {
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = color;
  if (kind === "ember") {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "snow") {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "bubble") {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawParticles(ctx: CanvasRenderingContext2D, state: GameEngineState, level: GameLevel): void {
  const theme = SKY_THEME_CONFIG[level.skyThemeKey as GameSkyTheme] ?? SKY_THEME_CONFIG.clear_day;
  for (const p of state.particles) drawParticle(ctx, p, theme.particleKind, theme.particleColor);
}

// Nền KHÔNG phải asset tile liền mạch (asset pack thường) — lặp trực tiếp lộ seam rõ. Vẽ 3 tile
// cạnh nhau, tile lẻ lật gương (ctx.scale(-1,1)) — mép tile lật trùng khít mép gốc tuyệt đối (không
// phải xấp xỉ như crossfade), đổi lại nội dung lặp kiểu "cánh bướm" mỗi 2 tile. Chấp nhận được cho
// bản admin test.
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  state: GameEngineState,
  w: number,
  h: number,
): void {
  if (!img.complete || img.naturalWidth === 0) return;
  const groundH = h * 0.42;
  const groundY = h - groundH;
  const offset = ((state.scrollX % w) + w) % w; // mod luôn dương
  // Lỗi đã gặp: dùng Math.round(scrollX / w) khiến "tileIndex" (quyết định tile nào bị lật gương)
  // đổi giá trị ở giữa quãng đường 1 tile (mỗi nửa chiều rộng tile), chứ không phải đúng lúc tile đó
  // cuộn hết ra khỏi màn hình — tile đang hiển thị giữa màn hình bỗng lật gương đột ngột, thấy như
  // giật/khựng 1 cái. Phải dùng Math.floor để tileIndex chỉ đổi đúng lúc offset quay vòng (scrollX
  // qua đúng 1 bội số của w) — khớp hệt thời điểm 1 tile cuộn hết, không còn đổi hướng giữa chừng.
  const baseTileIndex = Math.floor(state.scrollX / w);

  for (let i = -1; i <= 1; i++) {
    const tileX = i * w - offset;
    const tileIndex = baseTileIndex + i;
    ctx.save();
    if (tileIndex % 2 !== 0) {
      // lật gương quanh tâm tile
      ctx.translate(tileX + w, groundY);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, w, groundH);
    } else {
      ctx.drawImage(img, tileX, groundY, w, groundH);
    }
    ctx.restore();
  }
}

function drawPop(ctx: CanvasRenderingContext2D, e: GameEntity, state: GameEngineState): number {
  if (!e.collected || e.poppingUntil === null) return 1;
  const remain = (e.poppingUntil - state.elapsedMs) / POP_DURATION_MS;
  return Math.max(0, remain);
}

export function drawEntities(ctx: CanvasRenderingContext2D, state: GameEngineState): void {
  for (const e of state.entities) {
    const scale = drawPop(ctx, e, state);
    if (scale <= 0) continue;
    ctx.save();
    ctx.translate(e.worldX - state.scrollX, e.y);
    ctx.scale(scale, scale);
    if (e.kind === "item") {
      ctx.fillStyle = "#facc15";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.moveTo(0, -6);
      ctx.lineTo(0, 6);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#7f1d1d";
      ctx.beginPath();
      ctx.arc(0, 2, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-10, -8);
      ctx.lineTo(-4, -20);
      ctx.lineTo(2, -8);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2, -8);
      ctx.lineTo(8, -20);
      ctx.lineTo(14, -8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

const CHAR_PHASE_PER_FRAME = 0.7; // 1 đơn vị characterWalkPhase ứng với bao nhiêu frame — tốc độ hoạt ảnh

// Chọn frame hiện tại theo characterWalkPhase (đã tăng dần tỉ lệ theo scrollSpeedPxS ở updateEngine)
// — map tốc độ cao thì bước chân nhanh hơn, đúng cảm giác đang chạy nhanh hơn.
export function getCharacterFrameIndex(state: GameEngineState, frameCount: number): number {
  if (frameCount <= 0) return 0;
  return Math.floor(state.characterWalkPhase / CHAR_PHASE_PER_FRAME) % frameCount;
}

// Vẽ sprite nhân vật người chơi đã chọn (frames là ảnh đã preload ở GameCanvas.tsx — xem
// frontend/src/components/game/characters.ts). CHỈ di chuyển ngang: originX cố định theo % chiều
// rộng canvas, neo mép DƯỚI của sprite đúng groundY (không đổi theo frame dù frame cao/thấp khác
// nhau chút ít do bounding box khác nhau lúc cắt) — tuyệt đối không có thành phần nào cộng vào trục
// y theo state, khớp yêu cầu "nhân vật chỉ di chuyển ngang chứ không di chuyển lên xuống". Shadow đã
// có sẵn trong từng frame (asset gốc tự vẽ), không cần vẽ thêm.
const INVINCIBLE_BLINK_PERIOD_MS = 120; // 1 nhịp nhấp nháy ẩn/hiện — "tàng hình" lúc vừa trúng đòn

export function drawCharacterSprite(
  ctx: CanvasRenderingContext2D,
  frames: HTMLImageElement[],
  state: GameEngineState,
  w: number,
  h: number,
): void {
  if (frames.length === 0) return;
  // Tàng hình 2s sau khi trúng đòn — nhấp nháy ẩn/hiện (không ẩn LIÊN TỤC suốt 2s, vì vậy sẽ trông
  // như nhân vật biến mất hẳn khỏi màn hình, dễ gây hoang mang) thay phiên theo chu kỳ cố định,
  // chính là cách game thường thể hiện "bất tử tạm thời" sau khi trúng đòn.
  if (state.invincibleUntilMs !== null) {
    const blinkOn = Math.floor(state.elapsedMs / INVINCIBLE_BLINK_PERIOD_MS) % 2 === 0;
    if (!blinkOn) return;
  }

  const frameIndex = getCharacterFrameIndex(state, frames.length);
  const img = frames[frameIndex];
  if (!img.complete || img.naturalWidth === 0) return;

  const originX = w * CHAR_ORIGIN_X_RATIO;
  const groundY = h * CHAR_GROUND_Y_RATIO;
  const scale = CHAR_DISPLAY_HEIGHT / img.naturalHeight;
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  const drawX = Math.round(originX - drawW / 2);
  const drawY = Math.round(groundY - drawH);

  if (state.facingDirection === -1) {
    // Lật ngang quanh tâm sprite khi quay trái (sprite gốc vẽ quay phải) — translate ra tâm, scale(-1,1)
    // rồi vẽ lệch lại đúng vị trí cũ, giống kỹ thuật lật tile nền ở drawBackground.
    ctx.save();
    ctx.translate(drawX + drawW / 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -drawW / 2, drawY, drawW, drawH);
    ctx.restore();
  } else {
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }
}

function drawHazardHpBar(ctx: CanvasRenderingContext2D, x: number, y: number, ratio: number): void {
  const w = 34;
  const h = 4;
  const barX = x - w / 2;
  const barY = y - HAZARD_DISPLAY_SIZE / 2 - 10;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(barX - 1, barY - 1, w + 2, h + 2);
  ctx.fillStyle = "#3f3f46";
  ctx.fillRect(barX, barY, w, h);
  ctx.fillStyle = ratio > 0.3 ? "#ef4444" : "#f97316";
  ctx.fillRect(barX, barY, w * Math.max(0, ratio), h);
}

function drawHazardDeathEffect(ctx: CanvasRenderingContext2D, m: HazardMonster, elapsedMs: number): number {
  if (m.dyingUntil === null) return 1;
  const remain = Math.max(0, (m.dyingUntil - elapsedMs) / DEATH_ANIM_MS); // 1 -> 0
  if (m.deathDebris) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, remain);
    ctx.fillStyle = "#facc15";
    for (const d of m.deathDebris) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // "Phồng" lên nhanh (30% đầu) rồi xẹp dần về 0 — hiệu ứng pop kiểu game thường thấy khi hạ gục
  // mục tiêu, rõ ràng hơn hẳn chỉ mờ dần đơn thuần.
  const t = 1 - remain; // 0 -> 1
  return t < 0.3 ? 1 + (t / 0.3) * 0.3 : 1.3 * (1 - (t - 0.3) / 0.7);
}

// Vật phẩm lang thang (kind="item") — tái dùng đúng hình vẽ "đồng xu" placeholder của GameEntity kind
// item (xem drawEntities) thay vì ảnh quái, để người chơi phân biệt ngay là thứ vô hại/nên nhặt chứ
// không phải quái cần né/đánh — không cần thêm asset ảnh riêng.
function drawHazardItem(ctx: CanvasRenderingContext2D, m: HazardMonster, state: GameEngineState): void {
  const { x, y } = getHazardScreenPos(m, state.scrollX);
  const scale = drawHazardDeathEffect(ctx, m, state.elapsedMs);
  if (scale <= 0) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#facc15";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(6, 0);
  ctx.moveTo(0, -6);
  ctx.lineTo(0, 6);
  ctx.stroke();
  ctx.restore();
}

// images[] đã preload ở GameCanvas.tsx (xem hazard-monsters.ts pickRandomHazardSprites) — co theo
// chiều lớn hơn (ngang/dọc) về đúng HAZARD_DISPLAY_SIZE, giữ tỉ lệ khung hình gốc (sprite vuông lẫn
// ngang/dọc đều có trong 48 con, không ép cùng 1 tỉ lệ).
export function drawHazardMonsters(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  state: GameEngineState,
): void {
  for (const m of state.hazardMonsters) {
    if (m.kind === "item") {
      drawHazardItem(ctx, m, state);
      continue;
    }
    if (images.length === 0) continue;
    const img = images[m.imageIndex % images.length];
    if (!img.complete || img.naturalWidth === 0) continue;

    const { x, y } = getHazardScreenPos(m, state.scrollX);
    const deathScale = drawHazardDeathEffect(ctx, m, state.elapsedMs);
    if (deathScale <= 0) continue;

    const longSide = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = (HAZARD_DISPLAY_SIZE / longSide) * deathScale;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    ctx.drawImage(img, Math.round(x - drawW / 2), Math.round(y - drawH / 2), drawW, drawH);

    // Thanh máu nhỏ chỉ hiện khi đã "chạm trán" (bị bấm ít nhất 1 lần) và chưa bị hạ — không hiện
    // sẵn cho mọi quái để đỡ rối mắt khi chưa tương tác (xem yêu cầu "hiển thị nhỏ nhỏ khi focus").
    if (m.dyingUntil === null && m.hp < m.maxHp) {
      drawHazardHpBar(ctx, x, y, m.hp / m.maxHp);
    }
  }
}
