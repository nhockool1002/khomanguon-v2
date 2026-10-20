import { IsInt, Max, Min } from 'class-validator';

export class UpdateGameSettingsDto {
  @IsInt()
  @Min(1)
  @Max(10000)
  characterMaxHp: number;

  @IsInt()
  @Min(0)
  @Max(10000)
  monsterDamagePerHit: number;

  @IsInt()
  @Min(1)
  @Max(100000)
  hazardMonsterHp: number;

  @IsInt()
  @Min(1)
  @Max(10000)
  characterAttackDamage: number;

  @IsInt()
  @Min(0)
  @Max(100)
  hazardMonsterPercent: number;

  @IsInt()
  @Min(0)
  @Max(100)
  hazardItemPercent: number;
}
