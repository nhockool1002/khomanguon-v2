import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { AuthModule } from '../auth/auth.module';
import { SepayModule } from '../sepay/sepay.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [AuthModule, SepayModule, RealtimeModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
