import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CsrfGuard } from '../auth/csrf.guard';
import { TicketEmailKind } from '../generated/prisma/enums';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CouponsService } from '../coupons/coupons.service';
import { CreateCouponDto } from '../coupons/dto/create-coupon.dto';
import { UpdateCouponDto } from '../coupons/dto/update-coupon.dto';
import { CreateSpeakerDto } from '../speakers/dto/create-speaker.dto';
import { SpeakerPhotoUploadUrlDto } from '../speakers/dto/speaker-photo-upload-url.dto';
import { UpdateSpeakerDto } from '../speakers/dto/update-speaker.dto';
import { NewsletterService } from '../newsletter/newsletter.service';
import { NewsletterExportQueue } from '../newsletter/newsletter-export.queue';
import { UpdateTicketProductDto } from '../registrations/dto/update-ticket-product.dto';
import { RegistrationsService } from '../registrations/registrations.service';
import { SpeakersService } from '../speakers/speakers.service';
import { CreateSponsorDto } from '../sponsors/dto/create-sponsor.dto';
import { SponsorLogoUploadUrlDto } from '../sponsors/dto/sponsor-logo-upload-url.dto';
import { UpdateSponsorDto } from '../sponsors/dto/update-sponsor.dto';
import { SponsorApplicationsService } from '../sponsors/sponsor-applications.service';
import { SponsorsService } from '../sponsors/sponsors.service';
import { VolunteerApplicationsService } from '../volunteers/volunteer-applications.service';
import { AdminService } from './admin.service';
import { ChangeAttendeeEmailDto } from './dto/change-attendee-email.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { ListAdminUsersQueryDto } from './dto/list-admin-users.query';
import { ListRegistrationsQueryDto } from './dto/list-registrations.query';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { UpdateEventSettingsDto } from './dto/update-event-settings.dto';
import { VoidTicketDto } from './dto/void-ticket.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { ResendDateUpdateDto } from './dto/resend-date-update.dto';
import { ResendTicketEmailsDto } from './dto/resend-ticket-emails.dto';
import { ReissueTicketDto } from './dto/reissue-ticket.dto';
import { RestoreTicketDto } from './dto/restore-ticket.dto';
import { WithdrawTicketDto } from './dto/withdraw-ticket.dto';
import { CancelRegistrationDto } from './dto/cancel-registration.dto';
import { ListSpeakersQueryDto } from '../speakers/dto/list-speakers.query';
import { ListSponsorsQueryDto } from '../sponsors/dto/list-sponsors.query';
import { ListSponsorApplicationsQueryDto } from '../sponsors/dto/list-sponsor-applications.query';
import { ListNewsletterQueryDto } from '../newsletter/dto/list-newsletter.query';
import { ListVolunteerApplicationsQueryDto } from '../volunteers/dto/list-volunteer-applications.query';
import { RemindPendingDto } from './dto/remind-pending.dto';
import { ApproveVolunteerApplicationDto } from '../volunteers/dto/approve-volunteer-application.dto';
import { RejectVolunteerApplicationDto } from '../volunteers/dto/reject-volunteer-application.dto';
import { BulkApproveVolunteerApplicationsDto } from '../volunteers/dto/bulk-approve-volunteer-applications.dto';
import { BulkRejectVolunteerApplicationsDto } from '../volunteers/dto/bulk-reject-volunteer-applications.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, CsrfGuard)
@Roles('organizer', 'super_admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly speakers: SpeakersService,
    private readonly sponsors: SponsorsService,
    private readonly sponsorApplications: SponsorApplicationsService,
    private readonly newsletter: NewsletterService,
    private readonly newsletterExport: NewsletterExportQueue,
    private readonly registrations: RegistrationsService,
    private readonly coupons: CouponsService,
    private readonly volunteerApplications: VolunteerApplicationsService,
  ) {}

  @RequirePermissions('registrations.view')
  @Get('registrations')
  listRegistrations(@Query() query: ListRegistrationsQueryDto) {
    return this.admin.listRegistrations(query);
  }

  @RequirePermissions('registrations.view')
  @Get('registrations/:id')
  getRegistrationDetail(@Param('id') id: string) {
    return this.admin.getRegistrationDetail(id);
  }

  @Get('stats')
  getStats() {
    return this.admin.getStats();
  }

  @RequirePermissions('registrations.view')
  @Get('analytics')
  getAnalytics() {
    return this.admin.getAnalytics();
  }

  @RequirePermissions('registrations.sendReminder')
  @Post('registrations/remind-pending')
  remindPending(
    @Body() dto: RemindPendingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.remindPendingPayments(user.sub, dto.olderThanHours ?? 24);
  }

  @RequirePermissions('registrations.markPaid')
  @Post('registrations/:id/mark-paid')
  markPaid(
    @Param('id') id: string,
    @Body() dto: MarkPaidDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.markPaid(id, user.sub, dto.reason);
  }

  // Super admins only: it redirects where someone's ticket goes.
  @Roles('super_admin')
  @Patch('registrations/:id/email')
  changeAttendeeEmail(
    @Param('id') id: string,
    @Body() dto: ChangeAttendeeEmailDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.changeAttendeeEmail(id, user.sub, dto.email, dto.reason);
  }

  @RequirePermissions('registrations.resendTicket')
  @Post('registrations/:id/resend-ticket')
  resendTicket(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.admin.resendTicket(id, user.sub);
  }

  @RequirePermissions('registrations.voidTicket')
  @Post('registrations/:id/void')
  voidTicket(
    @Param('id') id: string,
    @Body() dto: VoidTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.voidTicket(id, user.sub, dto.reason, dto.password);
  }

  @RequirePermissions('registrations.reissueTicket')
  @Post('registrations/:id/reissue-ticket')
  reissueTicket(
    @Param('id') id: string,
    @Body() dto: ReissueTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.reissueTicket(id, user.sub, dto.reason);
  }

  @RequirePermissions('registrations.restoreTicket')
  @Post('registrations/:id/restore-ticket')
  restoreTicket(
    @Param('id') id: string,
    @Body() dto: RestoreTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.restoreTicket(id, user.sub, dto.reason);
  }

  @RequirePermissions('registrations.withdrawTicket')
  @Post('registrations/:id/withdraw-ticket')
  withdrawTicket(
    @Param('id') id: string,
    @Body() dto: WithdrawTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.withdrawTicket(id, user.sub, dto.reason, dto.password);
  }

  @RequirePermissions('registrations.cancel')
  @Post('registrations/:id/cancel')
  cancelRegistration(
    @Param('id') id: string,
    @Body() dto: CancelRegistrationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.cancelRegistration(
      id,
      user.sub,
      dto.reason,
      dto.password,
    );
  }

  @RequirePermissions('registrations.approveStudent')
  @Post('registrations/:id/approve-student')
  approveStudentRegistration(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.approveStudentRegistration(id, user.sub);
  }

  @RequirePermissions('registrations.rejectStudent')
  @Post('registrations/:id/reject-student')
  rejectStudentRegistration(
    @Param('id') id: string,
    @Body() dto: CancelRegistrationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.rejectStudentRegistration(
      id,
      user.sub,
      dto.reason,
      dto.password,
    );
  }

  @RequirePermissions('registrations.sendReminder')
  @Post('registrations/:id/send-reminder')
  sendPendingPaymentReminder(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.sendPendingPaymentReminder(id, user.sub);
  }

  @Post('export')
  requestExport() {
    return this.admin.requestExport().then((jobId) => ({ jobId }));
  }

  @Get('export/:jobId')
  getExportStatus(@Param('jobId') jobId: string) {
    return this.admin.getExportStatus(jobId);
  }

  // Every address held anywhere on the platform, de-duplicated. Bulk
  // personal data, so super admins only.
  @Roles('super_admin')
  @Get('emails')
  getEmailDirectory() {
    return this.admin.getEmailDirectory();
  }

  @Get('users')
  listAdminUsers(@Query() query: ListAdminUsersQueryDto) {
    return this.admin.listAdminUsers(query);
  }

  @Roles('super_admin')
  @Post('users')
  createAdminUser(
    @Body() dto: CreateAdminUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.createAdminUser(dto, user.sub);
  }

  @Roles('super_admin')
  @Patch('users/:id')
  updateAdminUser(
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.updateAdminUser(id, dto, user.sub);
  }

  @Roles('super_admin')
  @Delete('users/:id')
  deleteAdminUser(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.admin.deleteAdminUser(id, user.sub);
  }

  @Roles('super_admin')
  @Get('tickets/date-update-resend')
  getDateUpdateResendStatus(@Query('event') eventSlug: string) {
    return this.admin.getDateUpdateResendStatus(eventSlug);
  }

  @Roles('super_admin')
  @Post('tickets/date-update-resend')
  sendDateUpdateResend(
    @Query('event') eventSlug: string,
    @Body() dto: ResendDateUpdateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.sendDateUpdateResend(eventSlug, user.sub, dto.password);
  }

  @RequirePermissions('registrations.view')
  @Get('tickets/email-deliveries')
  getTicketEmailDeliveries(
    @Query('event') eventSlug: string,
    @Query('kind', new ParseEnumPipe(TicketEmailKind)) kind: TicketEmailKind,
  ) {
    return this.admin.getTicketEmailDeliveries(eventSlug, kind);
  }

  // Ticket resends need the resend permission; the new-date email stays
  // super-admin only, like the bulk new-date send.
  @RequirePermissions('registrations.resendTicket')
  @Post('tickets/email-deliveries/resend')
  resendTicketEmails(
    @Query('event') eventSlug: string,
    @Body() dto: ResendTicketEmailsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (dto.kind === 'date_update' && user.role !== 'super_admin') {
      throw new ForbiddenException(
        'Only a super admin can resend the new-date email.',
      );
    }
    return this.admin.resendTicketEmails(
      eventSlug,
      dto.kind,
      user.sub,
      dto.ticketIds,
    );
  }

  @RequirePermissions('eventSettings.manage')
  @Get('event-settings')
  getEventSettings(@Query('event') eventSlug: string) {
    return this.admin.getEventSettings(eventSlug);
  }

  @RequirePermissions('eventSettings.manage')
  @Patch('event-settings')
  updateEventSettings(
    @Query('event') eventSlug: string,
    @Body() dto: UpdateEventSettingsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.updateEventSettings(eventSlug, dto, user.sub);
  }

  @RequirePermissions('speakers.manage')
  @Get('speakers')
  listSpeakers(
    @Query('event') eventSlug: string,
    @Query() query: ListSpeakersQueryDto,
  ) {
    return this.speakers.listAdmin(eventSlug, query);
  }

  @RequirePermissions('speakers.manage')
  @Post('speakers')
  createSpeaker(
    @Body() dto: CreateSpeakerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.speakers.create(dto, user.sub);
  }

  @RequirePermissions('speakers.manage')
  @Patch('speakers/:id')
  updateSpeaker(
    @Param('id') id: string,
    @Body() dto: UpdateSpeakerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.speakers.update(id, dto, user.sub);
  }

  @RequirePermissions('speakers.manage')
  @Delete('speakers/:id')
  deleteSpeaker(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.speakers.remove(id, user.sub);
  }

  @RequirePermissions('speakers.manage')
  @Post('speakers/upload-url')
  createSpeakerPhotoUploadUrl(@Body() dto: SpeakerPhotoUploadUrlDto) {
    return this.speakers.createPhotoUploadUrl(dto);
  }

  @RequirePermissions('sponsors.manage')
  @Get('sponsors')
  listSponsors(
    @Query('event') eventSlug: string,
    @Query() query: ListSponsorsQueryDto,
  ) {
    return this.sponsors.listAdmin(eventSlug, query);
  }

  @RequirePermissions('sponsors.manage')
  @Post('sponsors')
  createSponsor(
    @Body() dto: CreateSponsorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sponsors.create(dto, user.sub);
  }

  @RequirePermissions('sponsors.manage')
  @Patch('sponsors/:id')
  updateSponsor(
    @Param('id') id: string,
    @Body() dto: UpdateSponsorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sponsors.update(id, dto, user.sub);
  }

  @RequirePermissions('sponsors.manage')
  @Delete('sponsors/:id')
  deleteSponsor(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.sponsors.remove(id, user.sub);
  }

  @RequirePermissions('sponsors.manage')
  @Post('sponsors/upload-url')
  createSponsorLogoUploadUrl(@Body() dto: SponsorLogoUploadUrlDto) {
    return this.sponsors.createLogoUploadUrl(dto);
  }

  @RequirePermissions('sponsors.manage')
  @Get('sponsor-applications')
  listSponsorApplications(
    @Query('event') eventSlug: string,
    @Query() query: ListSponsorApplicationsQueryDto,
  ) {
    return this.sponsorApplications.listAdmin(eventSlug, query);
  }

  @RequirePermissions('sponsors.manage')
  @Post('sponsor-applications/:id/approve')
  approveSponsorApplication(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sponsorApplications.approve(id, user.sub);
  }

  @RequirePermissions('sponsors.manage')
  @Post('sponsor-applications/:id/reject')
  rejectSponsorApplication(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sponsorApplications.reject(id, user.sub);
  }

  @RequirePermissions('newsletter.manage')
  @Get('newsletter')
  listNewsletterSubscribers(@Query() query: ListNewsletterQueryDto) {
    return this.newsletter.listAdmin(query);
  }

  @RequirePermissions('newsletter.manage')
  @Delete('newsletter/:id')
  deleteNewsletterSubscriber(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.newsletter.remove(id, user.sub);
  }

  @RequirePermissions('newsletter.manage')
  @Post('newsletter/export')
  requestNewsletterExport() {
    return this.newsletterExport.enqueue().then((jobId) => ({ jobId }));
  }

  @RequirePermissions('newsletter.manage')
  @Get('newsletter/export/:jobId')
  getNewsletterExportStatus(@Param('jobId') jobId: string) {
    return this.newsletterExport.getStatus(jobId);
  }

  @RequirePermissions('ticketSettings.manage')
  @Get('ticket-products')
  listTicketProducts(@Query('event') eventSlug: string) {
    return this.registrations.listAdminTicketProducts(eventSlug);
  }

  @RequirePermissions('ticketSettings.manage')
  @Patch('ticket-products/:id')
  updateTicketProduct(
    @Param('id') id: string,
    @Body() dto: UpdateTicketProductDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrations.updateTicketProduct(id, dto, user.sub);
  }

  @RequirePermissions('coupons.manage')
  @Get('coupons')
  listCoupons(@Query('event') eventSlug: string) {
    return this.coupons.listAdmin(eventSlug);
  }

  @RequirePermissions('coupons.manage')
  @Post('coupons')
  createCoupon(@Body() dto: CreateCouponDto, @CurrentUser() user: JwtPayload) {
    return this.coupons.create(dto, user.sub);
  }

  @RequirePermissions('coupons.manage')
  @Patch('coupons/:id')
  updateCoupon(
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.coupons.update(id, dto, user.sub);
  }

  @RequirePermissions('coupons.manage')
  @Delete('coupons/:id')
  deleteCoupon(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coupons.remove(id, user.sub);
  }

  @RequirePermissions('volunteers.manage')
  @Get('volunteer-applications')
  listVolunteerApplications(
    @Query('event') eventSlug: string,
    @Query() query: ListVolunteerApplicationsQueryDto,
  ) {
    return this.volunteerApplications.listAdmin(eventSlug, query);
  }

  @RequirePermissions('volunteers.manage')
  @Post('volunteer-applications/:id/approve')
  approveVolunteerApplication(
    @Param('id') id: string,
    @Body() dto: ApproveVolunteerApplicationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.volunteerApplications.approve(id, user.sub, dto.reason);
  }

  @RequirePermissions('volunteers.manage')
  @Post('volunteer-applications/:id/reject')
  rejectVolunteerApplication(
    @Param('id') id: string,
    @Body() dto: RejectVolunteerApplicationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.volunteerApplications.reject(id, user.sub, dto.reason);
  }

  @RequirePermissions('volunteers.manage')
  @Post('volunteer-applications/bulk-approve')
  bulkApproveVolunteerApplications(
    @Body() dto: BulkApproveVolunteerApplicationsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.volunteerApplications.bulkApprove(
      dto.ids,
      user.sub,
      dto.reason,
    );
  }

  @RequirePermissions('volunteers.manage')
  @Post('volunteer-applications/bulk-reject')
  bulkRejectVolunteerApplications(
    @Body() dto: BulkRejectVolunteerApplicationsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.volunteerApplications.bulkReject(dto.ids, user.sub, dto.reason);
  }
}
