import { GameCharacterKey } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SelectCharacterDto {
  @IsEnum(GameCharacterKey)
  characterKey: GameCharacterKey;
}
