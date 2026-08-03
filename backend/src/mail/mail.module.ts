import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailTemplatesController } from './mail-templates.controller';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [MailTemplatesController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
