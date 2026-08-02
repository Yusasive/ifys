import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthService } from '../auth/auth.service';
import { TicketEmailQueue } from '../email/ticket-email.queue';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TicketsService } from '../tickets/tickets.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { ListRegistrationsQueryDto } from './dto/list-registrations.query';
import { ExportQueue } from './export.queue';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly tickets: TicketsService,
    private readonly emailQueue: TicketEmailQueue,
    private readonly auditLog: AuditLogService,
    private readonly auth: AuthService,
    private readonly exportQueue: ExportQueue,
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

    // Signed URL generated fresh on each detail view — never store or
    // expose a long-lived/public link to the uploaded ID (TRD §10).
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

  // Reuses the exact same ticket-issuance path as the webhook (TRD §6:
  // "one single function that creates a ticket, not two divergent
  // implementations"), just claiming payment manually instead of via a
  // verified Flutterwave callback — e.g. a bank transfer reconciled by hand.
  async markPaid(registrationId: string, actorId: string) {
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
          provider: 'flutterwave',
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
    });

    return { ticket };
  }

  // Reuses the existing ticketCode/qrSecret — a resend must never mint a
  // new code, or an old printed copy and the resent copy would stop
  // agreeing with each other (TRD §7).
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

  async voidTicket(registrationId: string, actorId: string, password: string) {
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

    const voided = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'void' },
    });

    await this.auditLog.record({
      actorId,
      action: 'void_ticket',
      targetType: 'ticket',
      targetId: ticket.id,
    });

    return { ticket: voided };
  }

  requestExport() {
    return this.exportQueue.enqueue();
  }

  getExportStatus(jobId: string) {
    return this.exportQueue.getStatus(jobId);
  }

  // M6: door staff need real accounts provisioned before event day —
  // this replaces "edit the seed script and redeploy" with an actual
  // organizer-facing action, audit-logged like every other admin action
  // that changes who can do what.
  async createAdminUser(dto: CreateAdminUserDto, actorId: string) {
    const existing = await this.prisma.adminUser.findUnique({
      where: { email: dto.email },
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
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'create_admin_user',
      targetType: 'admin_user',
      targetId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async listAdminUsers() {
    const users = await this.prisma.adminUser.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { users };
  }
}
