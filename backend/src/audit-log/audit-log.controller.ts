import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditLogService } from './audit-log.service';
import { ListAuditLogQueryDto } from './dto/list-audit-log.query';

// Read-only — deliberately no CsrfGuard here (every route is a GET).
//
// This is its own controller rather than routes bolted onto
// AdminController because AdminController carries a class-level
// @Roles('organizer', 'super_admin'), which would exclude door_staff from
// every route on it. GET /admin/audit-log/me is the one route in the app
// door_staff needs to reach, so it needs a controller whose class-level
// guards don't already lock them out.
@Controller('admin/audit-log')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Roles('super_admin')
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
