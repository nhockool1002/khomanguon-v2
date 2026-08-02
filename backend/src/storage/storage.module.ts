import { Module } from '@nestjs/common';
import { R2ClientService } from './r2-client.service';

@Module({
  providers: [R2ClientService],
  exports: [R2ClientService],
})
export class StorageModule {}
