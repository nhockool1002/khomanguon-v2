import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { GameController } from './game.controller';
import { GameService } from './game.service';

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [GameController],
  providers: [GameService],
})
export class GameModule {}
