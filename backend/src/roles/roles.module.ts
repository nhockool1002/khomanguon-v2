import { Global, Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PermissionsGuard } from './guards/permissions.guard';

@Global()
@Module({
  providers: [RolesService, PermissionsGuard],
  exports: [RolesService, PermissionsGuard],
})
export class RolesModule {}
