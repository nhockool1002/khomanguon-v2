import { Injectable, NotFoundException } from '@nestjs/common';
import {
  GameCharacterKey,
  Prisma,
  WalletTxStatus,
  WalletTxType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletGateway } from '../realtime/wallet.gateway';
import { UpdateGameLevelsDto } from './dto/update-game-levels.dto';
import { UpdateGameSettingsDto } from './dto/update-game-settings.dto';
import {
  DEFAULT_GAME_SETTINGS,
  GAME_SETTINGS_KEY,
  type GameSettings,
} from './game-settings.types';

// Ép kiểu an toàn cho cột Json của Prisma — giống hệt toJsonValue() trong site-settings.service.ts.
function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class GameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletGateway: WalletGateway,
  ) {}

  listPlayableLevels() {
    return this.prisma.gameLevel.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  listAllLevels() {
    return this.prisma.gameLevel.findMany({ orderBy: { order: 'asc' } });
  }

  // UPDATE theo id cố định trong 1 transaction — KHÔNG deleteMany+createMany như
  // IntlTopupPackage (intl-topup.service.ts), vì GameLevel.id bị WalletTransaction.referenceId
  // tham chiếu (xem comment model GameLevel trong schema.prisma) — tái tạo id sẽ đứt tham chiếu
  // lịch sử ví cũ.
  async updateLevels(dto: UpdateGameLevelsDto) {
    await this.prisma.$transaction(
      dto.levels.map((l) =>
        this.prisma.gameLevel.update({
          where: { id: l.id },
          data: {
            name: l.name,
            skyThemeKey: l.skyThemeKey,
            winConditionType: l.winConditionType,
            targetCount: l.targetCount,
            scrollSpeedPxS: l.scrollSpeedPxS,
            spawnIntervalMs: l.spawnIntervalMs,
            rewardP: l.rewardP,
            isActive: l.isActive,
          },
        }),
      ),
    );
    return this.listAllLevels();
  }

  // Thưởng $P hoàn thành 1 level — rút gọn từ wallet.service.ts adjustBalance(): cùng 1
  // $transaction cho upsert Wallet + create WalletTransaction + update balance, rồi emit socket
  // SAU KHI transaction commit. Không ghi AuditLog (tự thưởng, không phải Admin tác động user khác
  // — xem comment WalletTxType.GAME_REWARD trong schema.prisma). Cùng transaction này cũng cập nhật
  // GamePlayerProgress (level hiện tại + tổng $P đã kiếm) — để trang Cài đặt Game biết user đang ở
  // đâu mà không cần tin tưởng số liệu client gửi lên ngoài levelId.
  async completeLevel(userId: string, levelId: string) {
    const level = await this.prisma.gameLevel.findUnique({
      where: { id: levelId },
    });
    if (!level || !level.isActive) {
      throw new NotFoundException('Level không tồn tại hoặc đã tắt');
    }

    const playable = await this.listPlayableLevels();
    const idx = playable.findIndex((l) => l.id === level.id);
    // idx có thể = -1 nếu Admin vừa tắt level này ngay lúc đang chơi — fallback về đầu danh sách
    // thay vì crash, vẫn trả nextLevel hợp lệ để FE tiếp tục mượt.
    const nextIdx = idx === -1 ? 0 : (idx + 1) % playable.length;
    const nextLevel = playable[nextIdx] ?? null;

    const tx = await this.prisma.$transaction(async (t) => {
      const wallet = await t.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId, balance: 0 },
      });
      const balanceAfter = wallet.balance + level.rewardP;
      const created = await t.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTxType.GAME_REWARD,
          amount: level.rewardP,
          balanceAfter,
          status: WalletTxStatus.SUCCESS,
          referenceType: 'game_level',
          referenceId: level.id,
          note: `Hoàn thành level: ${level.name}`,
        },
      });
      await t.wallet.update({
        where: { userId },
        data: { balance: balanceAfter },
      });

      await t.gamePlayerProgress.upsert({
        where: { userId },
        update: {
          currentLevelOrder: nextLevel?.order ?? 1,
          totalRewardP: { increment: level.rewardP },
        },
        create: {
          userId,
          currentLevelOrder: nextLevel?.order ?? 1,
          totalRewardP: level.rewardP,
        },
      });

      return created;
    });

    this.walletGateway.emitWalletUpdated(userId, { balance: tx.balanceAfter });

    return {
      rewardP: level.rewardP,
      balanceAfter: tx.balanceAfter,
      nextLevel,
      isRunComplete: idx !== -1 && idx === playable.length - 1,
    };
  }

  // Tạo lười lúc user mở trang Chơi thử lần đầu — characterKey=null bắt FE hiện màn chọn nhân vật
  // trước khi vào chơi (xem SelectCharacterDto).
  async getOrCreateProgress(userId: string) {
    return this.prisma.gamePlayerProgress.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async selectCharacter(userId: string, characterKey: GameCharacterKey) {
    return this.prisma.gamePlayerProgress.upsert({
      where: { userId },
      update: { characterKey },
      create: { userId, characterKey },
    });
  }

  // Danh sách "người đang chơi" cho trang Cài đặt Game — chỉ gồm user đã từng mở trang Chơi thử
  // (có dòng GamePlayerProgress, tạo lười ở getOrCreateProgress), sắp theo lần chơi gần nhất.
  listPlayers() {
    return this.prisma.gamePlayerProgress.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
      },
    });
  }

  // Reset tiến độ chơi về trạng thái ban đầu (level 1, chưa chọn nhân vật, tổng $P thống kê về 0).
  // CHỈ đụng GamePlayerProgress — không đụng Wallet/WalletTransaction (xem comment model
  // GamePlayerProgress trong schema.prisma): $P đã cộng vào ví là tiền thật, không tự động thu hồi
  // qua nút Reset này, muốn thu hồi Admin dùng chức năng điều chỉnh ví (wallet.adjust) riêng.
  async resetPlayer(userId: string) {
    const existing = await this.prisma.gamePlayerProgress.findUnique({
      where: { userId },
    });
    if (!existing) throw new NotFoundException('User chưa từng chơi game này');

    return this.prisma.gamePlayerProgress.update({
      where: { userId },
      data: {
        characterKey: null,
        currentLevelOrder: 1,
        totalRewardP: 0,
        startedAt: new Date(),
      },
    });
  }

  // Max HP + sát thương mỗi lần nhân vật chạm quái lang thang (hazard monster — khác "monster" kiểu
  // MONSTER_CATCH, xem frontend/src/components/game/hazard-monsters.ts) — cấu hình toàn cục (không
  // theo từng level) vì HP là thuộc tính nhân vật xuyên suốt cả lượt chơi, không phải thuộc tính map.
  async getSettings(): Promise<GameSettings> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: GAME_SETTINGS_KEY },
    });
    if (!row) return DEFAULT_GAME_SETTINGS;
    return {
      ...DEFAULT_GAME_SETTINGS,
      ...(row.value as Partial<GameSettings>),
    };
  }

  async updateSettings(dto: UpdateGameSettingsDto): Promise<GameSettings> {
    const next: GameSettings = {
      characterMaxHp: dto.characterMaxHp,
      monsterDamagePerHit: dto.monsterDamagePerHit,
      hazardMonsterHp: dto.hazardMonsterHp,
      characterAttackDamage: dto.characterAttackDamage,
      hazardMonsterPercent: dto.hazardMonsterPercent,
      hazardItemPercent: dto.hazardItemPercent,
    };
    await this.prisma.siteSetting.upsert({
      where: { key: GAME_SETTINGS_KEY },
      update: { value: toJsonValue(next) },
      create: { key: GAME_SETTINGS_KEY, value: toJsonValue(next) },
    });
    return next;
  }
}
