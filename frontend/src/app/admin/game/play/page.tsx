"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useWalletSocket } from "@/lib/socket";
import { PERMISSIONS } from "@/lib/permissions";
import type { GameCompleteLevelResult, GameLevel, GamePlayerProgress, GameSettings, Wallet } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";
import { GameCanvas } from "@/components/game/GameCanvas";
import { WIN_CONDITION_LABELS } from "@/components/game/sky-themes";
import { GAME_CHARACTERS, type GameCharacterKey } from "@/components/game/characters";

// Trang "Chơi thử" — Admin test mini-game nội bộ, chưa public. Auto-run + bấm/chạm thu thập, không
// có điều kiện thua (xem plan). Hoàn thành 1 level -> gọi POST .../complete thưởng $P thật vào ví
// chính Admin đang đăng nhập (tin client hoàn toàn, chưa có chống gian lận — chấp nhận được vì
// chỉ Admin-only, xem ghi chú trong plan trước khi mở rộng role khác).
//
// Tiến độ (nhân vật đã chọn + level hiện tại) lưu server-side qua GamePlayerProgress — không còn
// ephemeral như bản đầu, để trang Cài đặt Game biết "ai đang chơi, đang ở đâu" và Admin reset được.
export default function AdminGamePlayPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [levels, setLevels] = useState<GameLevel[] | null>(null);
  const [progress, setProgress] = useState<GamePlayerProgress | null>(null);
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [levelIndex, setLevelIndex] = useState<number | null>(null);
  const [collected, setCollected] = useState(0);
  const [hp, setHp] = useState<number | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [runComplete, setRunComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectingCharacter, setSelectingCharacter] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      apiFetch<GameLevel[]>("/game/play/levels"),
      apiFetch<GamePlayerProgress>("/game/play/progress"),
      apiFetch<GameSettings>("/game/play/settings"),
    ])
      .then(([lv, pr, st]) => {
        setLevels(lv);
        setProgress(pr);
        setSettings(st);
        setHp(st.characterMaxHp);
        const idx = lv.findIndex((l) => l.order === pr.currentLevelOrder);
        setLevelIndex(idx === -1 ? 0 : idx);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
    apiFetch<Wallet>("/wallet/me")
      .then(setWallet)
      .catch(() => {});
  }, [user]);

  useWalletSocket(!!user, (payload) => {
    setWallet((prev) => (prev ? { ...prev, balance: payload.balance } : prev));
  });

  const level = levels && levelIndex !== null ? (levels[levelIndex] ?? null) : null;
  const [dead, setDead] = useState(false);

  const handleProgress = useCallback((count: number) => setCollected(count), []);

  // HP về 0 — reset tiến độ (về level 1 + bắt chọn lại nhân vật, $P đã kiếm giữ nguyên) y hệt nút
  // Reset của Admin, chỉ khác là tự user gọi cho chính mình (POST /game/play/die, xem
  // backend/src/game/game.controller.ts). Gọi thẳng trong callback onDamage (không qua useEffect
  // theo dõi hp) — đây là callback từ hệ thống ngoài (GameCanvas rAF loop), đúng khuyến nghị
  // react-hooks/set-state-in-effect thay vì side-effect lồng trong effect theo dõi state.
  const handleDamage = useCallback(
    (hpRemaining: number) => {
      setHp(hpRemaining);
      if (hpRemaining > 0 || dead) return;
      setDead(true);
      setError(null);
      apiFetch<GamePlayerProgress>("/game/play/die", { method: "POST" })
        .then((res) => {
          setProgress(res);
          setLevelIndex(0);
          setCollected(0);
          setHp(settings?.characterMaxHp ?? null);
          setDead(false);
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
    },
    [dead, settings],
  );

  async function handlePickCharacter(characterKey: GameCharacterKey) {
    setError(null);
    setSelectingCharacter(true);
    try {
      const res = await apiFetch<GamePlayerProgress>("/game/play/character", {
        method: "PUT",
        body: JSON.stringify({ characterKey }),
      });
      setProgress(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSelectingCharacter(false);
    }
  }

  const handleLevelComplete = useCallback(() => {
    if (!level || submitting) return;
    setSubmitting(true);
    setError(null);
    apiFetch<GameCompleteLevelResult>(`/game/play/levels/${level.id}/complete`, { method: "POST" })
      .then((res) => {
        setWallet((prev) => (prev ? { ...prev, balance: res.balanceAfter } : prev));
        setToast(`🎉 Hoàn thành "${level.name}" — +${res.rewardP} $P`);
        if (res.isRunComplete) {
          setRunComplete(true);
        } else {
          setTimeout(() => {
            setToast(null);
            setCollected(0);
            setLevelIndex((i) => (levels && i !== null ? (i + 1) % levels.length : 0));
          }, 1800);
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"))
      .finally(() => setSubmitting(false));
  }, [level, levels, submitting]);

  function handlePlayAgain() {
    setRunComplete(false);
    setToast(null);
    setCollected(0);
    setLevelIndex(0);
    setHp(settings?.characterMaxHp ?? null);
  }

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.GAME_PLAY)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-zinc-900">Chơi thử Game</h1>
        <span className="rounded-lg bg-[#1d3557] px-4 py-2 font-mono text-sm font-bold text-white">
          {wallet?.balance ?? "—"} $P
        </span>
      </div>

      <ErrorBanner message={error} />

      {(levels === null || progress === null) && <p className="text-sm text-zinc-400">Đang tải...</p>}

      {progress && !progress.characterKey && (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-6">
          <p className="text-center text-sm font-medium text-zinc-700">Chọn nhân vật để bắt đầu chơi</p>
          <div className="flex flex-wrap justify-center gap-4">
            {GAME_CHARACTERS.map((c) => (
              <button
                key={c.key}
                type="button"
                disabled={selectingCharacter}
                onClick={() => handlePickCharacter(c.key)}
                className="flex w-40 flex-col items-center gap-2 rounded-lg border border-zinc-200 p-4 hover:border-[#1d3557] hover:bg-[#1d3557]/5 disabled:opacity-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.frameUrl(1)} alt={c.label} className="h-24 w-auto object-contain" />
                <span className="text-sm font-medium text-zinc-800">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {progress?.characterKey && levels?.length === 0 && (
        <p className="text-sm text-zinc-400">Chưa có level nào đang bật — vào Cài đặt Game để bật ít nhất 1 level.</p>
      )}

      {progress?.characterKey && level && !runComplete && !dead && settings && hp !== null && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-4 py-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-zinc-800">
                Level {level.order} · {level.name}
              </span>
              <span className="text-xs text-zinc-400">{WIN_CONDITION_LABELS[level.winConditionType]}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">HP</span>
                <div className="h-2 w-28 overflow-hidden rounded-full bg-zinc-200">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all"
                    style={{ width: `${Math.max(0, (hp / settings.characterMaxHp) * 100)}%` }}
                  />
                </div>
              </div>
              <span className="font-mono text-sm font-semibold text-[#1d3557]">
                {collected}/{level.targetCount}
              </span>
            </div>
          </div>

          <div className="relative flex justify-center">
            <GameCanvas
              key={level.id}
              level={level}
              characterKey={progress.characterKey}
              maxHp={settings.characterMaxHp}
              monsterDamagePerHit={settings.monsterDamagePerHit}
              hazardMonsterHp={settings.hazardMonsterHp}
              characterAttackDamage={settings.characterAttackDamage}
              hazardMonsterPercent={settings.hazardMonsterPercent}
              hazardItemPercent={settings.hazardItemPercent}
              onProgress={handleProgress}
              onLevelComplete={handleLevelComplete}
              onDamage={handleDamage}
            />
            {toast && (
              <div className="absolute inset-x-0 top-4 flex justify-center">
                <span className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow">
                  {toast}
                </span>
              </div>
            )}
          </div>
          <p className="text-center text-xs text-zinc-400">
            Giữ <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1 font-mono">→</kbd> hoặc{" "}
            <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1 font-mono">D</kbd> để tiến,{" "}
            <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1 font-mono">←</kbd> hoặc{" "}
            <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1 font-mono">A</kbd> để lùi (tối đa ~100
            bước) — bấm/chạm vào {level.winConditionType === "MONSTER_CATCH" ? "quái" : "vật phẩm"} khi tới gần. Chạm
            quái lang thang sẽ mất máu và được tàng hình 2 giây; bấm liên tiếp vào quái lang thang để tấn công và
            tiêu diệt (quái có thanh máu riêng khi bị đánh). Một số thứ lang thang là vật phẩm vô hại (đồng xu vàng)
            — bấm vào để nhặt, hồi lại một ít máu.
          </p>
        </div>
      )}

      {dead && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-200 py-12">
          <p className="text-2xl">💀</p>
          <p className="text-lg font-semibold text-zinc-800">Nhân vật đã gục ngã!</p>
          <p className="text-sm text-zinc-500">Đang đưa về level 1, bắt chọn lại nhân vật... $P đã kiếm không bị mất.</p>
        </div>
      )}

      {runComplete && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-200 py-12">
          <p className="text-2xl">🏆</p>
          <p className="text-lg font-semibold text-zinc-800">Hoàn thành vòng chơi!</p>
          <p className="text-sm text-zinc-500">Đã qua hết {levels?.length ?? 0} map — số dư hiện tại {wallet?.balance ?? "—"} $P.</p>
          <button
            type="button"
            onClick={handlePlayAgain}
            className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a]"
          >
            Chơi lại từ đầu
          </button>
        </div>
      )}
    </div>
  );
}
