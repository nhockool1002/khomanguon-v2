import { Module } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { NewsletterCronService } from './newsletter-cron.service';
import { NewsletterController } from './newsletter.controller';
import { AuthModule } from '../auth/auth.module';

// MailModule không cần import — @Global() (xem mail.module.ts), MailService tự inject được ở
// mọi module giống LinkReportsModule/FeedbackModule.
@Module({
  imports: [AuthModule],
  controllers: [NewsletterController],
  providers: [NewsletterService, NewsletterCronService],
})
export class NewsletterModule {}
