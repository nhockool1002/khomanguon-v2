import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { AuthModule } from '../auth/auth.module';
import { SepayModule } from '../sepay/sepay.module';

@Module({
  imports: [AuthModule, SepayModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
