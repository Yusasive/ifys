import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
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
import type {
  SponsorApplicationStatus,
  VolunteerApplicationStatus,
} from '../generated/prisma/enums';
import { VolunteerApplicationsService } from '../volunteers/volunteer-applications.service';
import { AdminService } from './admin.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { ListRegistrationsQueryDto } from './dto/list-registrations.query';
import { UpdateEventSettingsDto } from './dto/update-event-settings.dto';
import { VoidTicketDto } from './dto/void-ticket.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, CsrfGuard)
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

  // Only a super_admin can mint new admin accounts — an organizer alone
  // must not be able to create other organizer (or super_admin) accounts.
  @Roles('super_admin')
  @Post('users')
  createAdminUser(
    @Body() dto: CreateAdminUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.createAdminUser(dto, user.sub);
  }

  @Get('event-settings')
  getEventSettings(@Query('event') eventSlug: string) {
    return this.admin.getEventSettings(eventSlug);
  }

  @Patch('event-settings')
  updateEventSettings(
    @Query('event') eventSlug: string,
    @Body() dto: UpdateEventSettingsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.updateEventSettings(eventSlug, dto, user.sub);
  }

  @Get('speakers')
  listSpeakers(@Query('event') eventSlug: string) {
    return this.speakers.listAdmin(eventSlug);
  }

  @Post('speakers')
  createSpeaker(
    @Body() dto: CreateSpeakerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.speakers.create(dto, user.sub);
  }

  @Patch('speakers/:id')
  updateSpeaker(
    @Param('id') id: string,
    @Body() dto: UpdateSpeakerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.speakers.update(id, dto, user.sub);
  }

  @Delete('speakers/:id')
  deleteSpeaker(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.speakers.remove(id, user.sub);
  }

  @Post('speakers/upload-url')
  createSpeakerPhotoUploadUrl(@Body() dto: SpeakerPhotoUploadUrlDto) {
    return this.speakers.createPhotoUploadUrl(dto);
  }

  @Get('sponsors')
  listSponsors(@Query('event') eventSlug: string) {
    return this.sponsors.listAdmin(eventSlug);
  }

  @Post('sponsors')
  createSponsor(
    @Body() dto: CreateSponsorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sponsors.create(dto, user.sub);
  }

  @Patch('sponsors/:id')
  updateSponsor(
    @Param('id') id: string,
    @Body() dto: UpdateSponsorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sponsors.update(id, dto, user.sub);
  }

  @Delete('sponsors/:id')
  deleteSponsor(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.sponsors.remove(id, user.sub);
  }

  @Post('sponsors/upload-url')
  createSponsorLogoUploadUrl(@Body() dto: SponsorLogoUploadUrlDto) {
    return this.sponsors.createLogoUploadUrl(dto);
  }

  @Get('sponsor-applications')
  listSponsorApplications(
    @Query('event') eventSlug: string,
    @Query('status') status?: SponsorApplicationStatus,
  ) {
    return this.sponsorApplications.listAdmin(eventSlug, status);
  }

  @Post('sponsor-applications/:id/approve')
  approveSponsorApplication(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sponsorApplications.approve(id, user.sub);
  }

  @Post('sponsor-applications/:id/reject')
  rejectSponsorApplication(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sponsorApplications.reject(id, user.sub);
  }

  @Get('newsletter')
  listNewsletterSubscribers() {
    return this.newsletter.listAdmin();
  }

  @Delete('newsletter/:id')
  deleteNewsletterSubscriber(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.newsletter.remove(id, user.sub);
  }

  @Post('newsletter/export')
  requestNewsletterExport() {
    return this.newsletterExport.enqueue().then((jobId) => ({ jobId }));
  }

  @Get('newsletter/export/:jobId')
  getNewsletterExportStatus(@Param('jobId') jobId: string) {
    return this.newsletterExport.getStatus(jobId);
  }

  @Get('ticket-products')
  listTicketProducts(@Query('event') eventSlug: string) {
    return this.registrations.listAdminTicketProducts(eventSlug);
  }

  @Patch('ticket-products/:id')
  updateTicketProduct(
    @Param('id') id: string,
    @Body() dto: UpdateTicketProductDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrations.updateTicketProduct(id, dto, user.sub);
  }

  @Get('coupons')
  listCoupons(@Query('event') eventSlug: string) {
    return this.coupons.listAdmin(eventSlug);
  }

  @Post('coupons')
  createCoupon(@Body() dto: CreateCouponDto, @CurrentUser() user: JwtPayload) {
    return this.coupons.create(dto, user.sub);
  }

  @Patch('coupons/:id')
  updateCoupon(
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.coupons.update(id, dto, user.sub);
  }

  @Delete('coupons/:id')
  deleteCoupon(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coupons.remove(id, user.sub);
  }

  @Get('volunteer-applications')
  listVolunteerApplications(
    @Query('event') eventSlug: string,
    @Query('status') status?: VolunteerApplicationStatus,
  ) {
    return this.volunteerApplications.listAdmin(eventSlug, status);
  }

  @Post('volunteer-applications/:id/approve')
  approveVolunteerApplication(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.volunteerApplications.approve(id, user.sub);
  }

  @Post('volunteer-applications/:id/reject')
  rejectVolunteerApplication(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.volunteerApplications.reject(id, user.sub);
  }
}
