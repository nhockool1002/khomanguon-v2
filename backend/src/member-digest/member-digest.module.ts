import { Module } from '@nestjs/common';
import { MemberDigestService } from './member-digest.service';
import { MemberDigestCronService } from './member-digest-cron.service';
import { MemberDigestController } from './member-digest.controller';
import { AuthModule } from '../auth/auth.module';

// MailModule không cần import — @Global() (xem mail.module.ts), MailService tự inject được giống
// NewsletterModule/FeedbackModule.
@Module({
  imports: [AuthModule],
  controllers: [MemberDigestController],
  providers: [MemberDigestService, MemberDigestCronService],
})
export class MemberDigestModule {}
