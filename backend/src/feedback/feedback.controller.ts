import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CsrfGuard } from '../auth/csrf.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get('form')
  getForm() {
    return this.feedback.getForm();
  }

  // Public and anonymous, so keep one address from flooding it.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(@Body() dto: CreateFeedbackDto) {
    return this.feedback.create(dto);
  }
}

@Controller('admin/feedback')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, CsrfGuard)
@Roles('organizer', 'super_admin')
@RequirePermissions('feedback.view')
export class AdminFeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  list(@Query('event') eventSlug: string) {
    return this.feedback.listAdmin(eventSlug);
  }
}
