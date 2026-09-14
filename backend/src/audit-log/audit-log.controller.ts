import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditLogService } from './audit-log.service';
import { ListAuditLogQueryDto } from './dto/list-audit-log.query';

@Controller('admin/audit-log')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @RequirePermissions('auditLog.view')
  @Get()
  listSystemWide(@Query() query: ListAuditLogQueryDto) {
    return this.auditLog.listSystemWide(query);
  }

  @Roles('organizer', 'door_staff', 'super_admin')
  @Get('me')
  listMyActivity(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListAuditLogQueryDto,
  ) {
    return this.auditLog.listForActor(user.sub, query);
  }
}
