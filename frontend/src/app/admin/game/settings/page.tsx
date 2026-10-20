"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import type { GameLevel, GamePlayerAdminRow, GameSettings, GameWinConditionType } from "@/lib/types";
import { ErrorBanner, SuccessBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";
import { GAME_SKY_THEMES, SKY_THEME_CONFIG, WIN_CONDITION_LABELS } from "@/components/game/sky-themes";
import { GAME_CHARACTERS } from "@/components/game/characters";

function characterLabel(key: GamePlayerAdminRow["characterKey"]): string {
  if (!key) return "Chưa chọn";
  return GAME_CHARACTERS.find((c) => c.key === key)?.label ?? key;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN");
}

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]";

// Cài đặt 12 level mini-game nội bộ CMS — luôn đúng 12 dòng cố định (không thêm/xoá, khác trang
// Cài đặt thanh toán quốc tế). background chỉ preview, order/id không sửa được (xem PUT
// /game/admin/levels + backend/src/game/dto/update-game-levels.dto.ts).
export default function AdminGameSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [levels, setLevels] = useState<GameLevel[] | null>(null);
  const [players, setPlayers] = useState<GamePlayerAdminRow[] | null>(null);
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  const loadPlayers = useCallback(() => {
    apiFetch<GamePlayerAdminRow[]>("/game/admin/players")
      .then(setPlayers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
  }, []);

  useEffect(() => {
    if (!user) return;
    apiFetch<GameLevel[]>("/game/admin/levels")
      .then(setLevels)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
    apiFetch<GameSettings>("/game/admin/settings")
      .then(setSettings)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"));
    loadPlayers();
  }, [user, loadPlayers]);

  async function handleSaveSettings() {
    if (!settings) return;
    setError(null);
    setMessage(null);
    setSavingSettings(true);
    try {
      const res = await apiFetch<GameSettings>("/game/admin/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings(res);
      setMessage("Đã lưu cài đặt nhân vật.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleResetPlayer(row: GamePlayerAdminRow) {
    if (!confirm(`Reset tiến độ chơi của "${row.user.displayName}"? Người này sẽ phải chọn lại nhân vật và chơi lại từ level 1. $P đã kiếm được KHÔNG bị trừ.`)) {
      return;
    }
    setError(null);
    setResettingUserId(row.userId);
    try {
      await apiFetch(`/game/admin/players/${row.userId}/reset`, { method: "POST" });
      loadPlayers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setResettingUserId(null);
    }
  }

  const updateLevel = useCallback((id: string, patch: Partial<GameLevel>) => {
    setLevels((prev) => prev?.map((l) => (l.id === id ? { ...l, ...patch } : l)) ?? prev);
  }, []);

  async function handleSave() {
    if (!levels) return;
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const res = await apiFetch<GameLevel[]>("/game/admin/levels", {
        method: "PUT",
        body: JSON.stringify({
          levels: levels.map((l) => ({
            id: l.id,
            name: l.name,
            skyThemeKey: l.skyThemeKey,
            winConditionType: l.winConditionType,
            targetCount: l.targetCount,
            scrollSpeedPxS: l.scrollSpeedPxS,
            spawnIntervalMs: l.spawnIntervalMs,
            rewardP: l.rewardP,
            isActive: l.isActive,
          })),
        }),
      });
      setLevels(res);
      setMessage("Đã lưu cài đặt Game.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.GAME_MANAGE)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Cài đặt Game</h1>
      <p className="text-sm text-zinc-500">
        12 map cố định của mini-game nội bộ (chưa public) — Admin chơi thử ở trang{" "}
        <span className="font-medium">Chơi thử</span>. Ảnh nền chỉ xem trước, không sửa/upload được ở trang này.
      </p>

      <ErrorBanner message={error} />
      <SuccessBanner message={message} />

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Cài đặt nhân vật</h2>
          <p className="text-xs text-zinc-500">
            Áp dụng cho mọi level — quái lang thang (khác hẳn quái kiểu &quot;Bắt quái&quot; ở từng level) chạm vào
            nhân vật sẽ trừ máu theo đây, hết máu thì reset về level 1 giống nút Reset bên dưới. Người chơi cũng có
            thể bấm vào quái lang thang để tấn công — mỗi lần bấm trừ &quot;Sát thương nhân vật&quot; vào HP của quái,
            quái hết máu sẽ bị tiêu diệt (hiện hiệu ứng rồi hồi sinh ở vị trí khác). Hồ lang thang gồm cả quái (thù
            địch) và vật phẩm (đồng xu vàng, vô hại, bấm để nhặt và hồi máu) — 2 ô tỉ lệ bên dưới là TRỌNG SỐ tương
            đối, không bắt buộc cộng = 100 (vd 70/30 hay 7/3 cho kết quả như nhau); để item = 0 thì hồ lang thang chỉ
            toàn quái như trước.
          </p>
        </div>
        {settings === null && <p className="text-sm text-zinc-400">Đang tải...</p>}
        {settings && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                Máu tối đa (HP)
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={settings.characterMaxHp}
                  onChange={(e) => setSettings({ ...settings, characterMaxHp: Number(e.target.value) || 1 })}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                Sát thương mỗi lần chạm quái
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={settings.monsterDamagePerHit}
                  onChange={(e) => setSettings({ ...settings, monsterDamagePerHit: Number(e.target.value) || 0 })}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                Máu quái lang thang (HP)
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={settings.hazardMonsterHp}
                  onChange={(e) => setSettings({ ...settings, hazardMonsterHp: Number(e.target.value) || 1 })}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                Sát thương nhân vật mỗi lần bấm
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={settings.characterAttackDamage}
                  onChange={(e) => setSettings({ ...settings, characterAttackDamage: Number(e.target.value) || 1 })}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                % tỉ lệ quái xuất hiện (hồ lang thang)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.hazardMonsterPercent}
                  onChange={(e) => setSettings({ ...settings, hazardMonsterPercent: Number(e.target.value) || 0 })}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                % tỉ lệ vật phẩm xuất hiện (hồ lang thang)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.hazardItemPercent}
                  onChange={(e) => setSettings({ ...settings, hazardItemPercent: Number(e.target.value) || 0 })}
                  className={inputClass}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="w-fit rounded-md border border-[#1d3557] px-3 py-1.5 text-sm font-medium text-[#1d3557] hover:bg-[#1d3557]/5 disabled:opacity-50"
            >
              {savingSettings ? "Đang lưu..." : "Lưu cài đặt nhân vật"}
            </button>
          </>
        )}
      </div>

      {levels === null && <p className="text-sm text-zinc-400">Đang tải...</p>}

      <div className="flex flex-col gap-3">
        {levels?.map((level) => (
          <div key={level.id} className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4 sm:flex-row">
            <img
              src={level.backgroundUrl}
              alt={level.name}
              className="h-20 w-full flex-none rounded-md border border-zinc-100 bg-zinc-50 object-cover sm:w-36"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-500">
                  Level {level.order} · {level.id}
                </span>
                <label className="ml-auto flex items-center gap-1 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={level.isActive}
                    onChange={(e) => updateLevel(level.id, { isActive: e.target.checked })}
                  />
                  Bật
                </label>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex flex-col gap-1 text-xs text-zinc-600">
                  Tên map
                  <input
                    value={level.name}
                    onChange={(e) => updateLevel(level.id, { name: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-600">
                  Bầu trời/thời tiết
                  <select
                    value={level.skyThemeKey}
                    onChange={(e) => updateLevel(level.id, { skyThemeKey: e.target.value })}
                    className={inputClass}
                  >
                    {GAME_SKY_THEMES.map((key) => (
                      <option key={key} value={key}>
                        {SKY_THEME_CONFIG[key].label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-600">
                  Điều kiện qua màn
                  <select
                    value={level.winConditionType}
                    onChange={(e) =>
                      updateLevel(level.id, { winConditionType: e.target.value as GameWinConditionType })
                    }
                    className={inputClass}
                  >
                    {Object.entries(WIN_CONDITION_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-600">
                  Số lượng cần
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={level.targetCount}
                    onChange={(e) => updateLevel(level.id, { targetCount: Number(e.target.value) || 1 })}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-600">
                  Tốc độ cuộn (px/s)
                  <input
                    type="number"
                    min={20}
                    max={1000}
                    value={level.scrollSpeedPxS}
                    onChange={(e) => updateLevel(level.id, { scrollSpeedPxS: Number(e.target.value) || 20 })}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-600">
                  Nhịp xuất hiện (ms)
                  <input
                    type="number"
                    min={200}
                    max={10000}
                    value={level.spawnIntervalMs}
                    onChange={(e) => updateLevel(level.id, { spawnIntervalMs: Number(e.target.value) || 200 })}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-600">
                  Thưởng $P
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    value={level.rewardP}
                    onChange={(e) => updateLevel(level.id, { rewardP: Number(e.target.value) || 0 })}
                    className={inputClass}
                  />
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {levels && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-fit rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu cài đặt"}
        </button>
      )}

      <div className="mt-4 flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Người chơi</h2>
          <p className="text-sm text-zinc-500">
            Danh sách user đã từng mở trang Chơi thử. Reset chỉ đưa về level 1 + bắt chọn lại nhân vật — không đụng
            $P đã kiếm được (đó là $P thật đã vào ví).
          </p>
        </div>

        {players === null && <p className="text-sm text-zinc-400">Đang tải...</p>}
        {players?.length === 0 && <p className="text-sm text-zinc-400">Chưa có ai chơi game này.</p>}

        {players && players.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Nhân vật</th>
                  <th className="px-3 py-2 font-medium">Level hiện tại</th>
                  <th className="px-3 py-2 font-medium">Tổng $P đã kiếm</th>
                  <th className="px-3 py-2 font-medium">Lần chơi gần nhất</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {players.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-100">
                    <td className="px-3 py-2">
                      <p className="font-medium text-zinc-800">{row.user.displayName}</p>
                      <p className="text-xs text-zinc-400">{row.user.email}</p>
                    </td>
                    <td className="px-3 py-2 text-zinc-700">{characterLabel(row.characterKey)}</td>
                    <td className="px-3 py-2 text-zinc-700">Level {row.currentLevelOrder}</td>
                    <td className="px-3 py-2 font-mono text-zinc-700">{row.totalRewardP} $P</td>
                    <td className="px-3 py-2 text-zinc-500">{formatDateTime(row.updatedAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleResetPlayer(row)}
                        disabled={resettingUserId === row.userId}
                        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-zinc-100 disabled:opacity-50"
                      >
                        {resettingUserId === row.userId ? "Đang reset..." : "Reset"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
