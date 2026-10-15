import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthService } from '../auth/auth.service';
import { ROLE_DEFAULT_PERMISSIONS } from '../auth/permissions';
import { AdminAccountEmailQueue } from '../email/admin-account-email.queue';
import { RegistrationReminderEmailQueue } from '../email/registration-reminder-email.queue';
import { StudentReviewEmailQueue } from '../email/student-review-email.queue';
import { TicketEmailQueue } from '../email/ticket-email.queue';
import { TicketLifecycleEmailQueue } from '../email/ticket-lifecycle-email.queue';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TicketsService } from '../tickets/tickets.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { ListAdminUsersQueryDto } from './dto/list-admin-users.query';
import { ListRegistrationsQueryDto } from './dto/list-registrations.query';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { UpdateEventSettingsDto } from './dto/update-event-settings.dto';
import { getCategoryAvailability } from '../registrations/category-availability';
import { ExportQueue } from './export.queue';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly tickets: TicketsService,
    private readonly emailQueue: TicketEmailQueue,
    private readonly auditLog: AuditLogService,
    private readonly auth: AuthService,
    private readonly exportQueue: ExportQueue,
    private readonly adminAccountEmailQueue: AdminAccountEmailQueue,
    private readonly reminderQueue: RegistrationReminderEmailQueue,
    private readonly studentReviewEmailQueue: StudentReviewEmailQueue,
    private readonly ticketLifecycleEmailQueue: TicketLifecycleEmailQueue,
  ) {}

  async listRegistrations(query: ListRegistrationsQueryDto) {
    const where = {
      ...(query.status && { status: query.status }),
      ...((query.category || query.tier) && {
        ticketProduct: {
          ...(query.category && { category: query.category }),
          ...(query.tier && { tier: query.tier }),
        },
      }),
      ...(query.search && {
        attendee: {
          OR: [
            {
              fullName: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
            { email: { contains: query.search, mode: 'insensitive' as const } },
          ],
        },
      }),
    };

    const order = query.order ?? 'desc';
    const orderBy =
      query.sortBy === 'fullName'
        ? { attendee: { fullName: order } }
        : { [query.sortBy ?? 'createdAt']: order };

    const [total, registrations] = await this.prisma.$transaction([
      this.prisma.registration.count({ where }),
      this.prisma.registration.findMany({
        where,
        include: { attendee: true, ticketProduct: true, ticket: true },
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      registrations,
    };
  }

  async getRegistrationDetail(id: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: {
        attendee: true,
        ticketProduct: true,
        ticket: { include: { checkIns: true } },
        order: true,
      },
    });
    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    const studentIdSignedUrl = registration.studentIdFileUrl
      ? await this.storage.getDownloadUrl(registration.studentIdFileUrl)
      : null;

    return { ...registration, studentIdSignedUrl };
  }

  async getStats() {
    const total = await this.prisma.registration.count();
    const byStatus = await this.prisma.registration.groupBy({
      by: ['status'],
      _count: { _all: true },
      orderBy: { status: 'asc' },
    });
    const registrationsByProduct = await this.prisma.registration.groupBy({
      by: ['ticketProductId'],
      _count: { _all: true },
      orderBy: { ticketProductId: 'asc' },
    });
    const allProducts = await this.prisma.ticketProduct.findMany({
      select: { id: true, category: true, tier: true },
    });
    const ticketsIssued = await this.prisma.ticket.count();
    const checkedIn = await this.prisma.ticket.count({
      where: { status: 'used' },
    });

    const productById = new Map(allProducts.map((p) => [p.id, p]));
    const categoryCounts: Record<string, number> = {};
    const tierCounts: Record<string, number> = {};
    for (const group of registrationsByProduct) {
      const product = productById.get(group.ticketProductId);
      if (!product) continue;
      categoryCounts[product.category] =
        (categoryCounts[product.category] ?? 0) + group._count._all;
      tierCounts[product.tier] =
        (tierCounts[product.tier] ?? 0) + group._count._all;
    }

    return {
      total,
      byStatus: Object.fromEntries(
        byStatus.map((s) => [s.status, s._count._all]),
      ),
      byCategory: categoryCounts,
      byTier: tierCounts,
      ticketsIssued,
      checkedIn,
    };
  }

  async markPaid(registrationId: string, actorId: string, reason: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { ticketProduct: true, order: true },
    });
    if (!registration) {
      throw new NotFoundException('Registration not found');
    }
    if (registration.status === 'paid') {
      throw new ConflictException('This registration is already paid.');
    }

    if (registration.order) {
      await this.prisma.order.update({
        where: { id: registration.order.id },
        data: { status: 'paid', paidAt: new Date() },
      });
    } else {
      await this.prisma.order.create({
        data: {
          registrationId: registration.id,
          amountMinor: registration.ticketProduct.priceKobo,
          currency: registration.ticketProduct.currency,
          provider: 'paystack',
          providerReference: `manual-${registration.id}`,
          status: 'paid',
          paidAt: new Date(),
        },
      });
    }

    const ticket = await this.tickets.issueTicketForRegistration(
      registration.id,
    );
    await this.emailQueue.enqueue(ticket.id);

    await this.auditLog.record({
      actorId,
      action: 'mark_paid',
      targetType: 'registration',
      targetId: registration.id,
      metadata: { reason },
    });

    return { ticket };
  }

  async approveStudentRegistration(registrationId: string, actorId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
    });
    if (!registration) {
      throw new NotFoundException('Registration not found');
    }
    if (registration.status !== 'pending_review') {
      throw new ConflictException('This registration is not awaiting review.');
    }

    const ticket = await this.tickets.issueTicketForRegistration(
      registration.id,
    );
    await this.emailQueue.enqueue(ticket.id);

    await this.auditLog.record({
      actorId,
      action: 'approve_student_registration',
      targetType: 'registration',
      targetId: registration.id,
    });

    return { ticket };
  }

  async rejectStudentRegistration(
    registrationId: string,
    actorId: string,
    reason: string,
    password: string,
  ) {
    const passwordOk = await this.auth.verifyPassword(actorId, password);
    if (!passwordOk) {
      throw new UnauthorizedException('Incorrect password');
    }

    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
    });
    if (!registration) {
      throw new NotFoundException('Registration not found');
    }
    if (registration.status !== 'pending_review') {
      throw new ConflictException('This registration is not awaiting review.');
    }

    const updated = await this.prisma.registration.update({
      where: { id: registrationId },
      data: { status: 'cancelled', cancellationReason: reason },
    });

    await this.studentReviewEmailQueue.enqueue(
      registrationId,
      'rejected',
      reason,
    );

    await this.auditLog.record({
      actorId,
      action: 'reject_student_registration',
      targetType: 'registration',
      targetId: registrationId,
      metadata: { reason },
    });

    return updated;
  }

  async resendTicket(registrationId: string, actorId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { registrationId },
    });
    if (!ticket) {
      throw new BadRequestException(
        'No ticket has been issued for this registration yet.',
      );
    }

    await this.emailQueue.enqueue(ticket.id);

    await this.auditLog.record({
      actorId,
      action: 'resend_ticket',
      targetType: 'ticket',
      targetId: ticket.id,
    });

    return { resent: true };
  }

  // One-time bulk resend after the event date moved (Nov 7 -> Nov 5). Every
  // non-void ticket gets its existing QR code and ticket code re-emailed with
  // a short date-update note. Each send is recorded in the audit log, which
  // is also how a second run knows to skip people who already got it.
  private async findDateUpdateTickets(eventSlug: string) {
    if (!eventSlug) {
      throw new BadRequestException('Query parameter "event" is required.');
    }
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${eventSlug}"`);
    }
    const tickets = await this.prisma.ticket.findMany({
      where: { status: { not: 'void' }, registration: { eventId: event.id } },
      select: { id: true },
    });
    const sentLogs = await this.prisma.auditLog.findMany({
      where: {
        action: 'resend_ticket_date_update',
        targetId: { in: tickets.map((t) => t.id) },
      },
      select: { targetId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const sentIds = new Set(sentLogs.map((l) => l.targetId));
    return {
      event,
      tickets,
      pending: tickets.filter((t) => !sentIds.has(t.id)),
      sentCount: sentIds.size,
      lastSentAt: sentLogs[0]?.createdAt ?? null,
    };
  }

  async getDateUpdateResendStatus(eventSlug: string) {
    const { event, tickets, pending, sentCount, lastSentAt } =
      await this.findDateUpdateTickets(eventSlug);
    return {
      eventStartsAt: event.startsAt,
      totalTickets: tickets.length,
      alreadySent: sentCount,
      pending: pending.length,
      lastSentAt,
    };
  }

  async sendDateUpdateResend(
    eventSlug: string,
    actorId: string,
    password: string,
  ) {
    const passwordOk = await this.auth.verifyPassword(actorId, password);
    if (!passwordOk) {
      throw new UnauthorizedException('Incorrect password');
    }
    const { pending } = await this.findDateUpdateTickets(eventSlug);

    for (const ticket of pending) {
      // Recorded per ticket, so pressing Send again later only reaches
      // tickets that were not included in an earlier run.
      await this.auditLog.record({
        actorId,
        action: 'resend_ticket_date_update',
        targetType: 'ticket',
        targetId: ticket.id,
      });
      await this.emailQueue.enqueue(ticket.id, 'date_updated');
    }

    return { queued: pending.length };
  }

  async voidTicket(
    registrationId: string,
    actorId: string,
    reason: string,
    password: string,
  ) {
    const passwordOk = await this.auth.verifyPassword(actorId, password);
    if (!passwordOk) {
      throw new UnauthorizedException('Incorrect password');
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { registrationId },
    });
    if (!ticket) {
      throw new NotFoundException('No ticket exists for this registration.');
    }
    if (ticket.status === 'void') {
      throw new ConflictException('This ticket is already void.');
    }

    const voided = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'void',
        lastActionType: 'voided',
        lastActionReason: reason,
        lastActionAt: new Date(),
        lastActionByAdminId: actorId,
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'void_ticket',
      targetType: 'ticket',
      targetId: ticket.id,
      metadata: { reason },
    });

    await this.ticketLifecycleEmailQueue.enqueue(ticket.id, 'voided');

    return { ticket: voided };
  }

  async reissueTicket(registrationId: string, actorId: string, reason: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { registrationId },
    });
    if (!ticket) {
      throw new NotFoundException('No ticket exists for this registration.');
    }
    if (ticket.status === 'void') {
      throw new ConflictException(
        'This ticket is void — restore it before reissuing.',
      );
    }

    const reissued = await this.tickets.reissueTicket(ticket.id);
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        lastActionType: 'reissued',
        lastActionReason: reason,
        lastActionAt: new Date(),
        lastActionByAdminId: actorId,
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'reissue_ticket',
      targetType: 'ticket',
      targetId: ticket.id,
      metadata: { reason },
    });

    await this.emailQueue.enqueue(reissued.id, 'reissued');

    return { ticket: reissued };
  }

  async restoreTicket(registrationId: string, actorId: string, reason: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { registrationId },
      include: { checkIns: true },
    });
    if (!ticket) {
      throw new NotFoundException('No ticket exists for this registration.');
    }
    if (ticket.status !== 'void') {
      throw new ConflictException('This ticket is not void.');
    }

    const restoredStatus = ticket.checkIns.length > 0 ? 'used' : 'unused';

    const restored = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: restoredStatus,
        lastActionType: 'restored',
        lastActionReason: reason,
        lastActionAt: new Date(),
        lastActionByAdminId: actorId,
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'restore_ticket',
      targetType: 'ticket',
      targetId: ticket.id,
      metadata: { reason },
    });

    await this.ticketLifecycleEmailQueue.enqueue(ticket.id, 'restored');

    return { ticket: restored };
  }

  async withdrawTicket(
    registrationId: string,
    actorId: string,
    reason: string,
    password: string,
  ) {
    const passwordOk = await this.auth.verifyPassword(actorId, password);
    if (!passwordOk) {
      throw new UnauthorizedException('Incorrect password');
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { registrationId },
    });
    if (!ticket) {
      throw new NotFoundException('No ticket exists for this registration.');
    }
    if (ticket.status === 'void') {
      throw new ConflictException('This ticket is already void.');
    }
    if (ticket.lastActionType !== 'reissued') {
      throw new ConflictException(
        'Only a previously reissued ticket can be withdrawn — use Void instead.',
      );
    }

    const withdrawn = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'void',
        lastActionType: 'withdrawn',
        lastActionReason: reason,
        lastActionAt: new Date(),
        lastActionByAdminId: actorId,
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'withdraw_ticket',
      targetType: 'ticket',
      targetId: ticket.id,
      metadata: { reason },
    });

    await this.ticketLifecycleEmailQueue.enqueue(ticket.id, 'withdrawn');

    return { ticket: withdrawn };
  }

  async cancelRegistration(
    id: string,
    actorId: string,
    reason: string,
    password: string,
  ) {
    const passwordOk = await this.auth.verifyPassword(actorId, password);
    if (!passwordOk) {
      throw new UnauthorizedException('Incorrect password');
    }

    const registration = await this.prisma.registration.findUnique({
      where: { id },
    });
    if (!registration) {
      throw new NotFoundException('Registration not found');
    }
    if (registration.status !== 'pending_payment') {
      throw new ConflictException(
        'Only pending-payment registrations can be cancelled this way.',
      );
    }

    const updated = await this.prisma.registration.update({
      where: { id },
      data: { status: 'cancelled', cancellationReason: reason },
    });

    await this.auditLog.record({
      actorId,
      action: 'cancel_registration',
      targetType: 'registration',
      targetId: id,
      metadata: { reason },
    });

    return updated;
  }

  async sendPendingPaymentReminder(id: string, actorId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
    });
    if (!registration) {
      throw new NotFoundException('Registration not found');
    }
    if (registration.status !== 'pending_payment') {
      throw new ConflictException(
        'Only pending-payment registrations can be reminded.',
      );
    }

    await this.reminderQueue.enqueue(id);

    await this.auditLog.record({
      actorId,
      action: 'send_pending_payment_reminder',
      targetType: 'registration',
      targetId: id,
    });

    return { sent: true };
  }

  requestExport() {
    return this.exportQueue.enqueue();
  }

  getExportStatus(jobId: string) {
    return this.exportQueue.getStatus(jobId);
  }

  async createAdminUser(dto: CreateAdminUserDto, actorId: string) {
    const existing = await this.prisma.adminUser.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const user = await this.prisma.adminUser.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: dto.role,

        permissions: dto.permissions ?? ROLE_DEFAULT_PERMISSIONS[dto.role],
        mustChangePassword: true,
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'create_admin_user',
      targetType: 'admin_user',
      targetId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    try {
      await this.adminAccountEmailQueue.enqueue({
        name: user.name,
        email: user.email,
        password: dto.password,
        role: user.role,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to queue account-created email for ${user.email}: ${String(err)}`,
      );
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      mustChangePassword: user.mustChangePassword,
      permissions: user.permissions,
    };
  }

  async listAdminUsers(query: ListAdminUsersQueryDto) {
    const select = {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      mustChangePassword: true,
      notifyOnStudentRegistration: true,
      permissions: true,
    };

    const [total, users] = await this.prisma.$transaction([
      this.prisma.adminUser.count(),
      this.prisma.adminUser.findMany({
        select,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { total, page: query.page, pageSize: query.pageSize, users };
  }

  async updateAdminUser(id: string, dto: UpdateAdminUserDto, actorId: string) {
    const existing = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Admin user not found');
    }

    if (existing.role === 'super_admin') {
      throw new ForbiddenException(
        'super_admin accounts cannot be modified through this endpoint',
      );
    }

    const promotingToSuperAdmin = dto.role === 'super_admin';
    if (promotingToSuperAdmin) {
      const passwordOk = await this.auth.verifyPassword(actorId, dto.password!);
      if (!passwordOk) {
        throw new UnauthorizedException('Incorrect password');
      }
    }

    if (dto.email && dto.email.toLowerCase() !== existing.email.toLowerCase()) {
      const emailTaken = await this.prisma.adminUser.findFirst({
        where: { email: { equals: dto.email, mode: 'insensitive' } },
      });
      if (emailTaken) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }
    }

    const roleChanged = dto.role !== undefined && dto.role !== existing.role;

    const permissions =
      dto.permissions ??
      (roleChanged ? ROLE_DEFAULT_PERMISSIONS[dto.role!] : undefined);

    const updated = await this.prisma.adminUser.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        permissions,
        notifyOnStudentRegistration: dto.notifyOnStudentRegistration,
      },
    });

    if (roleChanged) {
      await this.auth.revokeAllSessions(id);
    }

    await this.auditLog.record({
      actorId,
      action: promotingToSuperAdmin
        ? 'promote_admin_to_super_admin'
        : 'update_admin_user',
      targetType: 'admin_user',
      targetId: updated.id,
      metadata: {
        email: updated.email,
        role: updated.role,
        ...(roleChanged && { previousRole: existing.role }),
        ...(promotingToSuperAdmin && { reason: dto.reason }),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      createdAt: updated.createdAt,
      mustChangePassword: updated.mustChangePassword,
      notifyOnStudentRegistration: updated.notifyOnStudentRegistration,
      permissions: updated.permissions,
    };
  }

  async deleteAdminUser(id: string, actorId: string) {
    if (id === actorId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const existing = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Admin user not found');
    }
    if (existing.role === 'super_admin') {
      throw new ForbiddenException(
        'super_admin accounts cannot be deleted through this endpoint',
      );
    }

    await this.prisma.adminUser.delete({ where: { id } });

    await this.auditLog.record({
      actorId,
      action: 'delete_admin_user',
      targetType: 'admin_user',
      targetId: id,
      metadata: { email: existing.email, role: existing.role },
    });

    return { deleted: true };
  }

  async getEventSettings(eventSlug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${eventSlug}"`);
    }
    return this.eventSettingsFor(event);
  }

  private async eventSettingsFor(event: {
    id: string;
    ticketPurchasingPaused: boolean;
    volunteerApplicationsPaused: boolean;
    sponsorshipApplicationsPaused: boolean;
  }) {
    return {
      ticketPurchasingPaused: event.ticketPurchasingPaused,
      volunteerApplicationsPaused: event.volunteerApplicationsPaused,
      sponsorshipApplicationsPaused: event.sponsorshipApplicationsPaused,
      categoryCapacities: await getCategoryAvailability(this.prisma, event.id),
    };
  }

  async updateEventSettings(
    eventSlug: string,
    dto: UpdateEventSettingsDto,
    actorId: string,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${eventSlug}"`);
    }

    const updatedEvent = await this.prisma.$transaction(async (tx) => {
      for (const { category, capacity } of dto.categoryCapacities ?? []) {
        await tx.categoryCapacity.upsert({
          where: { eventId_category: { eventId: event.id, category } },
          update: { capacity },
          create: { eventId: event.id, category, capacity },
        });
      }
      return tx.event.update({
        where: { id: event.id },
        data: {
          ticketPurchasingPaused: dto.ticketPurchasingPaused,
          volunteerApplicationsPaused: dto.volunteerApplicationsPaused,
          sponsorshipApplicationsPaused: dto.sponsorshipApplicationsPaused,
        },
      });
    });
    const updated = await this.eventSettingsFor(updatedEvent);

    await this.auditLog.record({
      actorId,
      action: 'update_event_settings',
      targetType: 'event',
      targetId: event.id,
      metadata: dto as Record<string, unknown>,
    });

    return updated;
  }
}
