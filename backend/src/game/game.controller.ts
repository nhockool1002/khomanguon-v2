import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GameService } from './game.service';
import { UpdateGameLevelsDto } from './dto/update-game-levels.dto';
import { SelectCharacterDto } from './dto/select-character.dto';
import { UpdateGameSettingsDto } from './dto/update-game-settings.dto';

interface AuthUser {
  id: string;
  email: string;
}

// play (game.play) và manage (game.manage) tách route riêng — PermissionsGuard là AND-only
// (xem roles/guards/permissions.guard.ts: required.every(...)), không có khái niệm "1-trong-2
// quyền" trên cùng 1 route.
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.GAME_PLAY)
  @Get('play/levels')
  listPlayable() {
    return this.gameService.listPlayableLevels();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.GAME_PLAY)
  @Post('play/levels/:levelId/complete')
  complete(@CurrentUser() user: AuthUser, @Param('levelId') levelId: string) {
    return this.gameService.completeLevel(user.id, levelId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.GAME_PLAY)
  @Get('play/progress')
  getProgress(@CurrentUser() user: AuthUser) {
    return this.gameService.getOrCreateProgress(user.id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.GAME_PLAY)
  @Put('play/character')
  selectCharacter(
    @CurrentUser() user: AuthUser,
    @Body() dto: SelectCharacterDto,
  ) {
    return this.gameService.selectCharacter(user.id, dto.characterKey);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.GAME_PLAY)
  @Get('play/settings')
  getPlaySettings() {
    return this.gameService.getSettings();
  }

  // Nhân vật hết máu (chạm quái lang thang quá nhiều lần) — reset tiến độ CHÍNH MÌNH, dùng lại đúng
  // logic resetPlayer() của Admin nhưng tự phục vụ (@CurrentUser, không nhận userId tuỳ ý qua URL).
  // HP tự nó KHÔNG lưu server (xem comment GameSettings) nên hành động "chết" chỉ cần gọi tới đây,
  // không cần xác nhận HP=0 phía server (tin client — chấp nhận được vì chỉ Admin-only chưa public,
  // cùng mức tin cậy với completeLevel()).
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.GAME_PLAY)
  @Post('play/die')
  die(@CurrentUser() user: AuthUser) {
    return this.gameService.resetPlayer(user.id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.GAME_MANAGE)
  @Get('admin/levels')
  listAll() {
    return this.gameService.listAllLevels();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.GAME_MANAGE)
  @Put('admin/levels')
  update(@Body() dto: UpdateGameLevelsDto) {
    return this.gameService.updateLevels(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.GAME_MANAGE)
  @Get('admin/players')
  listPlayers() {
    return this.gameService.listPlayers();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.GAME_MANAGE)
  @Get('admin/settings')
  getAdminSettings() {
    return this.gameService.getSettings();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.GAME_MANAGE)
  @Put('admin/settings')
  updateSettings(@Body() dto: UpdateGameSettingsDto) {
    return this.gameService.updateSettings(dto);
  }

  // Reset tiến độ 1 người chơi cụ thể (không đụng $P đã kiếm — xem game.service.ts resetPlayer).
  // Đây là thao tác Admin tác động lên user khác nên để auto-audit mặc định (không @SkipAudit()),
  // khác complete() ở trên vốn là hành động tự phục vụ của chính user.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.GAME_MANAGE)
  @Post('admin/players/:userId/reset')
  resetPlayer(@Param('userId') userId: string) {
    return this.gameService.resetPlayer(userId);
  }
}
