import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CheckInsService } from './check-ins.service';
import { ScanDto } from './dto/scan.dto';
import { SyncDto } from './dto/sync.dto';
import { UndoDto } from './dto/undo.dto';

// Door staff share the venue's wifi (one IP), so throttle each station
// separately rather than the whole venue together.
function scanTracker(req: Record<string, any>): string {
  const body = req.body as { stationId?: unknown } | undefined;
  return typeof body?.stationId === 'string'
    ? `station:${body.stationId}`
    : String(req.ip);
}

@Controller('checkin')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('door_staff', 'organizer', 'super_admin')
export class CheckInsController {
  constructor(private readonly checkIns: CheckInsService) {}

  @RequirePermissions('checkin.scan')
  @Throttle({
    default: { limit: 120, ttl: 60_000, getTracker: scanTracker },
  })
  @Post('scan')
  scan(@Body() dto: ScanDto, @CurrentUser() user: JwtPayload) {
    return this.checkIns.scan(dto, user.sub);
  }

  @RequirePermissions('checkin.scan')
  @Get('search')
  search(@Query('q') q = '') {
    return this.checkIns.search(q);
  }

  @RequirePermissions('checkin.scan')
  @Post('undo')
  undo(@Body() dto: UndoDto, @CurrentUser() user: JwtPayload) {
    return this.checkIns.undo(dto.ticketId, user.sub);
  }

  @Get('status')
  getStatus() {
    return this.checkIns.getStatus();
  }

  @RequirePermissions('checkin.scan')
  @Get('offline-index')
  getOfflineIndex(@Query('updatedSince') updatedSince?: string) {
    if (updatedSince === undefined) return this.checkIns.getOfflineIndex();
    const since = new Date(updatedSince);
    if (Number.isNaN(since.getTime())) {
      throw new BadRequestException('updatedSince must be an ISO date');
    }
    return this.checkIns.getOfflineIndex(since);
  }

  @RequirePermissions('checkin.scan')
  @Post('sync')
  sync(@Body() dto: SyncDto, @CurrentUser() user: JwtPayload) {
    return this.checkIns.sync(dto.scans, user.sub);
  }
}
