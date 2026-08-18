import { Global, Module } from '@nestjs/common';
import { BadgesService } from './badges.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';

// @Global() — BadgesService được gọi từ nhiều module không liên quan nhau (posts, comments, auth,
// sepay), cùng lý do/pattern với UserActivityModule (xem comment ở đó).
@Global()
@Module({
  imports: [NotificationsModule, RealtimeModule],
  providers: [BadgesService],
  exports: [BadgesService],
})
export class BadgesModule {}
