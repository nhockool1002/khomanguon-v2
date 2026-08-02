import { Module } from '@nestjs/common';
import { WidgetsService } from './widgets.service';
import { WidgetsController } from './widgets.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [WidgetsController],
  providers: [WidgetsService],
})
export class WidgetsModule {}
