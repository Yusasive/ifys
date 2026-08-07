import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CheckInsService } from './check-ins.service';
import { ScanDto } from './dto/scan.dto';
import { SyncDto } from './dto/sync.dto';

@Controller('checkin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('door_staff', 'organizer', 'super_admin')
export class CheckInsController {
  constructor(private readonly checkIns: CheckInsService) {}

  // TRD §5/§10: rate limited specifically to blunt short-code
  // brute-forcing — generous enough for a volunteer scanning quickly,
  // tight enough that guessing through the code space isn't practical.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('scan')
  scan(@Body() dto: ScanDto, @CurrentUser() user: JwtPayload) {
    return this.checkIns.scan(dto, user.sub);
  }

  @Get('status')
  getStatus() {
    return this.checkIns.getStatus();
  }

  // TRD §8: downloaded once a station comes online, then relied on while
  // offline. Not throttled like /scan — this is a full snapshot fetched
  // occasionally, not a per-guess request.
  @Get('offline-index')
  getOfflineIndex() {
    return this.checkIns.getOfflineIndex();
  }

  @Post('sync')
  sync(@Body() dto: SyncDto, @CurrentUser() user: JwtPayload) {
    return this.checkIns.sync(dto.scans, user.sub);
  }
}
