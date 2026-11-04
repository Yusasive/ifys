import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CertificateEmailQueue,
  registeredTicketWhere,
} from '../email/certificate-email.queue';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly queue: CertificateEmailQueue,
  ) {}

  private async findEvent(eventSlug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${eventSlug}"`);
    }
    return event;
  }

  // Everyone who will get a certificate: successfully registered (paid, ticket not void), any category.
  // Built live on each request, like the name tags.
  async listRecipients(eventSlug: string) {
    const event = await this.findEvent(eventSlug);
    const tickets = await this.prisma.ticket.findMany({
      where: registeredTicketWhere(event.id),
      include: {
        registration: { include: { attendee: true } },
        emailDeliveries: { where: { kind: 'certificate' } },
      },
      orderBy: { registration: { attendee: { fullName: 'asc' } } },
    });
    return {
      sendAt: this.queue.sendAt.toISOString(),
      recipients: tickets.map((ticket) => {
        const delivery = ticket.emailDeliveries[0];
        return {
          id: ticket.id,
          name: ticket.registration.attendee.fullName,
          email: ticket.registration.attendee.email,
          delivery: delivery?.status ?? 'not_sent',
          deliveryError: delivery?.error ?? null,
          sentAt: delivery?.sentAt?.toISOString() ?? null,
        };
      }),
    };
  }

  // The Organising Team, for their own (separate) certificates: names only,
  // in the same order as their name tags.
  async listOrganisingTeam(eventSlug: string) {
    const event = await this.findEvent(eventSlug);
    const members = await this.prisma.committeeMember.findMany({
      where: { eventId: event.id },
      include: { position: true },
      orderBy: [
        { position: { displayOrder: 'asc' } },
        { position: { name: 'asc' } },
        { fullName: 'asc' },
      ],
    });
    return members.map((member) => ({
      id: member.id,
      name: member.fullName,
      position: member.position.name,
    }));
  }

  // One sample certificate to an address of the admin's choosing, so the
  // PDF and email can be checked before the real send. Touches no delivery
  // records.
  async sendTest(eventSlug: string, email: string, name?: string) {
    const event = await this.findEvent(eventSlug);
    await this.emailService.sendCertificateEmail(email, {
      recipientName: name?.trim() || 'Sample Attendee',
      eventName: event.name,
      supportEmail: this.config.getOrThrow<string>('SUPPORT_EMAIL'),
    });
    return { sent: true };
  }
}
