import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

@Global()
@Module({
  // AuditLogController's guards (JwtAuthGuard/RolesGuard) need JwtService
  // and AuthService, which only AuthModule provides — AuditLogModule being
  // @Global() makes AuditLogService injectable everywhere without this,
  // but a controller's own guard dependencies still have to be imported
  // explicitly.
  imports: [AuthModule],
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
