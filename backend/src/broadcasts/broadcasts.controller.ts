import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BroadcastsService } from './broadcasts.service';
import { PreviewAudienceDto } from './dto/preview-audience.dto';
import { SendBroadcastDto } from './dto/send-broadcast.dto';
import { TestBroadcastDto } from './dto/test-broadcast.dto';

@Controller('admin/broadcasts')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, CsrfGuard)
@Roles('organizer', 'super_admin')
@RequirePermissions('messaging.send')
export class BroadcastsController {
  constructor(private readonly broadcasts: BroadcastsService) {}

  @Get()
  list(@Query('event') eventSlug: string) {
    return this.broadcasts.list(eventSlug);
  }

  @Post('audience-preview')
  previewAudience(@Body() dto: PreviewAudienceDto) {
    return this.broadcasts.previewAudience(dto.eventSlug, dto.audience);
  }

  @Post('preview')
  renderPreview(@Body() dto: TestBroadcastDto) {
    return this.broadcasts.renderPreview(dto.eventSlug, dto);
  }

  @Post('test')
  sendTest(@Body() dto: TestBroadcastDto, @CurrentUser() user: JwtPayload) {
    return this.broadcasts.sendTest(dto.eventSlug, dto, user.sub);
  }

  @Post()
  send(@Body() dto: SendBroadcastDto, @CurrentUser() user: JwtPayload) {
    return this.broadcasts.send(dto, user.sub);
  }
}
