import { Module } from '@nestjs/common';
import { StorageProvidersService } from './storage-providers.service';
import { StorageProvidersController } from './storage-providers.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [StorageProvidersController],
  providers: [StorageProvidersService],
  exports: [StorageProvidersService],
})
export class StorageProvidersModule {}
