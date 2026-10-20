import { Type } from 'class-transformer';
import { GameWinConditionType } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { GAME_SKY_THEMES, type GameSkyTheme } from '../game.constants';

// order/backgroundUrl CỐ Ý không có ở đây — 2 field này không sửa được qua trang Cài đặt Game
// (background là asset tĩnh cắt sẵn, order cố định 1..12 theo id).
export class GameLevelUpdateDto {
  @IsString()
  @MinLength(1)
  id: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @IsIn(GAME_SKY_THEMES)
  skyThemeKey: GameSkyTheme;

  @IsEnum(GameWinConditionType)
  winConditionType: GameWinConditionType;

  @IsInt()
  @Min(1)
  @Max(50)
  targetCount: number;

  @IsInt()
  @Min(20)
  @Max(1000)
  scrollSpeedPxS: number;

  @IsInt()
  @Min(200)
  @Max(10000)
  spawnIntervalMs: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  rewardP: number;

  @IsBoolean()
  isActive: boolean;
}

// Luôn gửi đủ 12 dòng trong 1 lần lưu (giống trang Cài đặt thanh toán quốc tế) — service UPDATE
// theo id cố định, không deleteMany+createMany (xem game.service.ts updateLevels).
export class UpdateGameLevelsDto {
  @ArrayMinSize(12)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => GameLevelUpdateDto)
  levels: GameLevelUpdateDto[];
}
