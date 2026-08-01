import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { ListRegistrationsQueryDto } from './dto/list-registrations.query';
import { VoidTicketDto } from './dto/void-ticket.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('organizer')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('registrations')
  listRegistrations(@Query() query: ListRegistrationsQueryDto) {
    return this.admin.listRegistrations(query);
  }

  @Get('registrations/:id')
  getRegistrationDetail(@Param('id') id: string) {
    return this.admin.getRegistrationDetail(id);
  }

  @Get('stats')
  getStats() {
    return this.admin.getStats();
  }

  @Post('registrations/:id/mark-paid')
  markPaid(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.admin.markPaid(id, user.sub);
  }

  @Post('registrations/:id/resend-ticket')
  resendTicket(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.admin.resendTicket(id, user.sub);
  }

  @Post('registrations/:id/void')
  voidTicket(
    @Param('id') id: string,
    @Body() dto: VoidTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.voidTicket(id, user.sub, dto.password);
  }

  @Post('export')
  requestExport() {
    return this.admin.requestExport().then((jobId) => ({ jobId }));
  }

  @Get('export/:jobId')
  getExportStatus(@Param('jobId') jobId: string) {
    return this.admin.getExportStatus(jobId);
  }

  @Get('users')
  listAdminUsers() {
    return this.admin.listAdminUsers();
  }

  @Post('users')
  createAdminUser(
    @Body() dto: CreateAdminUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.createAdminUser(dto, user.sub);
  }
}
