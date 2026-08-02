import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WalletGateway } from './wallet.gateway';

@Module({
  imports: [JwtModule.register({})],
  providers: [WalletGateway],
  exports: [WalletGateway],
})
export class RealtimeModule {}
