import { Module } from '@nestjs/common';
import { ExtensionMfaService } from './extension-mfa.service';
import { ExtensionMfaController } from './extension-mfa.controller';
import { ApiClientGuard } from '../common/guards/api-client.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ExtensionMfaController],
  providers: [ExtensionMfaService, ApiClientGuard],
})
export class ExtensionMfaModule {}
