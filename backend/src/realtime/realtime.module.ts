import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WalletGateway } from './wallet.gateway';
import { NotificationGateway } from './notification.gateway';

@Module({
  imports: [JwtModule.register({})],
  providers: [WalletGateway, NotificationGateway],
  exports: [WalletGateway, NotificationGateway],
})
export class RealtimeModule {}
