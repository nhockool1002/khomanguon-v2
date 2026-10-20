"use client";

import { useEffect, useRef } from "react";
import type { GameLevel } from "@/lib/types";
import {
  collectEntity,
  collectHazardItem,
  createEngineState,
  damageHazardMonster,
  drawBackground,
  drawCharacterSprite,
  drawClouds,
  drawEntities,
  drawHazardMonsters,
  drawParticles,
  drawSky,
  drawSkyStreaks,
  drawWindStreaks,
  hitTestEntity,
  hitTestHazardMonster,
  updateEngine,
  HAZARD_COUNT,
  type GameEngineState,
} from "./game-engine";
import { getCharacterConfig, type GameCharacterKey } from "./characters";
import { pickRandomHazardSprites } from "./hazard-monsters";

const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 360;
const MAX_FRAME_DT_MS = 50; // clamp — tab chuyển nền quay lại không làm entity "dịch chuyển tức thời"

interface GameCanvasProps {
  level: GameLevel;
  characterKey: GameCharacterKey;
  maxHp: number;
  monsterDamagePerHit: number;
  hazardMonsterHp: number;
  characterAttackDamage: number;
  hazardMonsterPercent: number;
  hazardItemPercent: number;
  onLevelComplete: () => void;
  onProgress: (collected: number) => void;
  onDamage: (hpRemaining: number) => void;
}

// Toàn bộ state động (engine, timer rAF) nằm trong useRef — KHÔNG dùng useState cho vòng lặp, tránh
// re-render 60fps và stale closure. 1 effect sở hữu trọn vẹn: tạo engine, đăng ký input, chạy rAF,
// và dọn dẹp (cancelAnimationFrame + gỡ listener + null engine ref) khi unmount hoặc đổi level.
export function GameCanvas({
  level,
  characterKey,
  maxHp,
  monsterDamagePerHit,
  hazardMonsterHp,
  characterAttackDamage,
  hazardMonsterPercent,
  hazardItemPercent,
  onLevelComplete,
  onProgress,
  onDamage,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCompleteRef = useRef(onLevelComplete);
  const onProgressRef = useRef(onProgress);
  const onDamageRef = useRef(onDamage);

  useEffect(() => {
    onCompleteRef.current = onLevelComplete;
  }, [onLevelComplete]);
  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);
  useEffect(() => {
    onDamageRef.current = onDamage;
  }, [onDamage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = LOGICAL_WIDTH * dpr;
    canvas.height = LOGICAL_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    const bgImage = new Image();
    bgImage.src = level.backgroundUrl;

    const charConfig = getCharacterConfig(characterKey);
    const charFrames: HTMLImageElement[] = Array.from({ length: charConfig.frameCount }, (_, i) => {
      const img = new Image();
      img.src = charConfig.frameUrl(i + 1);
      return img;
    });

    // Chọn ngẫu nhiên HAZARD_COUNT sprite quái lang thang mỗi lần vào level — đa dạng giữa các lượt
    // chơi thay vì luôn cùng 1 bộ (xem hazard-monsters.ts, 48 sprite có sẵn).
    const hazardSprites = pickRandomHazardSprites(HAZARD_COUNT);
    const hazardImages: HTMLImageElement[] = hazardSprites.map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });

    const state: GameEngineState = createEngineState(
      level,
      LOGICAL_WIDTH,
      LOGICAL_HEIGHT,
      maxHp,
      hazardImages.length,
      hazardMonsterHp,
      hazardMonsterPercent,
      hazardItemPercent,
    );
    let rafId: number | null = null;
    let lastTs: number | null = null;

    function handlePointerDown(ev: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * LOGICAL_WIDTH;
      const y = ((ev.clientY - rect.top) / rect.height) * LOGICAL_HEIGHT;
      const hit = hitTestEntity(state, x, y);
      if (hit) {
        collectEntity(state, hit);
        onProgressRef.current(state.collectedCount);
        return;
      }
      // Bấm vào quái/vật phẩm lang thang — 2 loại trộn chung 1 hồ theo tỉ lệ cấu hình CMS (xem
      // pickHazardKind trong game-engine.ts). Quái: gây sát thương theo chỉ số tấn công nhân vật
      // (damageHazardMonster). Vật phẩm: nhặt ngay, hồi máu (collectHazardItem) — không có khái niệm
      // "nhiều lần bấm" như quái.
      const hitMonster = hitTestHazardMonster(state, x, y);
      if (hitMonster) {
        if (hitMonster.kind === "monster") {
          damageHazardMonster(state, hitMonster, characterAttackDamage);
        } else {
          collectHazardItem(state, hitMonster);
        }
      }
    }
    canvas.addEventListener("pointerdown", handlePointerDown);

    // Nhân vật không tự chạy nữa — giữ phím để di chuyển (xem updateEngine direction param). Gắn ở
    // window (không phải canvas) để không bắt phải click/focus vào canvas trước mới nhận được phím.
    // preventDefault riêng 4 phím này để tránh trình duyệt cuộn trang theo mũi tên, không đụng phím khác.
    let movingRight = false;
    let movingLeft = false;
    function handleKeyDown(ev: KeyboardEvent) {
      if (ev.key === "ArrowRight" || ev.key === "d" || ev.key === "D") {
        movingRight = true;
        ev.preventDefault();
      } else if (ev.key === "ArrowLeft" || ev.key === "a" || ev.key === "A") {
        movingLeft = true;
        ev.preventDefault();
      }
    }
    function handleKeyUp(ev: KeyboardEvent) {
      if (ev.key === "ArrowRight" || ev.key === "d" || ev.key === "D") movingRight = false;
      else if (ev.key === "ArrowLeft" || ev.key === "a" || ev.key === "A") movingLeft = false;
    }
    // Buông tab/mất focus (vd chuyển sang tab khác) mà không kịp bắt keyup — nhân vật sẽ bị "kẹt"
    // tiếp tục di chuyển mãi; reset cả 2 cờ khi cửa sổ mất focus để tránh kẹt phím.
    function handleBlur() {
      movingRight = false;
      movingLeft = false;
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    function frame(ts: number) {
      if (lastTs === null) lastTs = ts;
      const dt = Math.min(ts - lastTs, MAX_FRAME_DT_MS);
      lastTs = ts;

      const direction = movingRight === movingLeft ? 0 : movingRight ? 1 : -1;
      updateEngine(state, dt, level, LOGICAL_WIDTH, LOGICAL_HEIGHT, direction, monsterDamagePerHit);
      if (state.justTookDamage) {
        onDamageRef.current(state.hp);
      }
      // justHealed đến từ nhặt vật phẩm lang thang (pointerdown, ngoài vòng lặp updateEngine) — không
      // tự reset trong updateEngine như justTookDamage, nên tự đọc rồi tự xoá cờ ngay tại đây.
      if (state.justHealed) {
        state.justHealed = false;
        onDamageRef.current(state.hp);
      }

      ctx!.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      drawSky(ctx!, level, LOGICAL_WIDTH, LOGICAL_HEIGHT, state);
      drawClouds(ctx!, state);
      drawSkyStreaks(ctx!, state);
      drawWindStreaks(ctx!, state);
      drawParticles(ctx!, state, level);
      drawBackground(ctx!, bgImage, state, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      drawHazardMonsters(ctx!, hazardImages, state);
      drawCharacterSprite(ctx!, charFrames, state, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      drawEntities(ctx!, state);

      if (state.collectedCount >= level.targetCount && !state.completedFired) {
        state.completedFired = true;
        onCompleteRef.current();
        return; // dừng chain rAF — đổi level sẽ unmount/remount effect này qua key [level.id]
      }
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    level.id,
    characterKey,
    maxHp,
    monsterDamagePerHit,
    hazardMonsterHp,
    characterAttackDamage,
    hazardMonsterPercent,
    hazardItemPercent,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", maxWidth: LOGICAL_WIDTH, aspectRatio: `${LOGICAL_WIDTH} / ${LOGICAL_HEIGHT}` }}
      className="touch-none rounded-lg border border-zinc-200 shadow-sm"
    />
  );
}
