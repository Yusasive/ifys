import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '../audit-log/audit-log.service';
import { BroadcastEmailQueue } from '../email/broadcast-email.queue';
import {
  isBlankBroadcastHtml,
  renderBroadcastBodyHtml,
  sanitizeBroadcastHtml,
} from '../email/broadcast-html';
import { renderEmailShell } from '../email/email-shell';
import { EmailService } from '../email/email.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BroadcastAudienceDto } from './dto/broadcast-audience.dto';
import { BroadcastContentDto } from './dto/broadcast-content.dto';
import { SendBroadcastDto } from './dto/send-broadcast.dto';

const SAMPLE_SIZE = 8;

export interface Recipient {
  email: string;
  fullName: string;
}

@Injectable()
export class BroadcastsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auditLog: AuditLogService,
    private readonly emailService: EmailService,
    private readonly broadcastQueue: BroadcastEmailQueue,
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

  // Validates and normalizes the admin-written content: sanitized body,
  // CTA label/url only when both are given.
  private normalizeContent(dto: BroadcastContentDto) {
    const bodyHtml = sanitizeBroadcastHtml(dto.bodyHtml);
    if (isBlankBroadcastHtml(bodyHtml)) {
      throw new BadRequestException('The message body is empty.');
    }
    const ctaLabel = dto.ctaLabel?.trim() || null;
    const ctaUrl = dto.ctaUrl?.trim() || null;
    if (!!ctaLabel !== !!ctaUrl) {
      throw new BadRequestException(
        'A button needs both a label and a link (or leave both empty).',
      );
    }
    return { subject: dto.subject.trim(), bodyHtml, ctaLabel, ctaUrl };
  }

  // Resolves an audience to unique recipients. Attendee emails aren't
  // unique (one person can register more than once), so recipients are
  // de-duplicated case-insensitively — nobody gets the same email twice.
  private async resolveRecipients(
    eventId: string,
    audience: BroadcastAudienceDto,
  ): Promise<Recipient[]> {
    const where: Prisma.RegistrationWhereInput = audience.registrationIds
      ?.length
      ? { eventId, id: { in: audience.registrationIds } }
      : {
          eventId,
          ...(audience.statuses?.length && {
            status: { in: audience.statuses },
          }),
          ...((audience.categories?.length || audience.tiers?.length) && {
            ticketProduct: {
              ...(audience.categories?.length && {
                category: { in: audience.categories },
              }),
              ...(audience.tiers?.length && { tier: { in: audience.tiers } }),
            },
          }),
        };

    const registrations = await this.prisma.registration.findMany({
      where,
      select: { attendee: { select: { email: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const byEmail = new Map<string, Recipient>();
    for (const { attendee } of registrations) {
      const key = attendee.email.trim().toLowerCase();
      if (!byEmail.has(key)) {
        byEmail.set(key, {
          email: attendee.email.trim(),
          fullName: attendee.fullName,
        });
      }
    }
    return [...byEmail.values()];
  }

  async previewAudience(eventSlug: string, audience: BroadcastAudienceDto) {
    const event = await this.findEvent(eventSlug);
    const recipients = await this.resolveRecipients(event.id, audience);
    return {
      count: recipients.length,
      sample: recipients.slice(0, SAMPLE_SIZE),
    };
  }

  // Full email HTML for the admin's in-page preview. The inline cid: logo
  // only resolves inside a real email, so it's swapped for the copy the
  // frontend serves.
  async renderPreview(eventSlug: string, dto: BroadcastContentDto) {
    const event = await this.findEvent(eventSlug);
    const content = this.normalizeContent(dto);
    const html = renderEmailShell({
      eventName: event.name,
      bodyHtml: renderBroadcastBodyHtml({
        ...content,
        recipientName: 'Aisha Bello',
      }),
      supportEmail: this.config.getOrThrow<string>('SUPPORT_EMAIL'),
    }).replace(
      'cid:brand-logo',
      `${this.config.getOrThrow<string>('FRONTEND_ORIGIN')}/email-logo.png`,
    );
    return { html };
  }

  // Sends the draft to the signed-in admin only, immediately (not queued),
  // so an SMTP problem surfaces right away instead of in a worker log.
  async sendTest(eventSlug: string, dto: BroadcastContentDto, actorId: string) {
    const event = await this.findEvent(eventSlug);
    const content = this.normalizeContent(dto);
    const admin = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id: actorId },
    });
    await this.emailService.sendBroadcastEmail(admin.email, {
      ...content,
      subject: `[Test] ${content.subject}`,
      recipientName: admin.name,
      eventName: event.name,
      supportEmail: this.config.getOrThrow<string>('SUPPORT_EMAIL'),
    });
    return { sentTo: admin.email };
  }

  async send(dto: SendBroadcastDto, actorId: string) {
    const event = await this.findEvent(dto.eventSlug);
    const content = this.normalizeContent(dto);
    const recipients = await this.resolveRecipients(event.id, dto.audience);
    if (recipients.length === 0) {
      throw new BadRequestException('No recipients match this selection.');
    }

    const broadcast = await this.prisma.emailBroadcast.create({
      data: {
        eventId: event.id,
        ...content,
        audienceJson: { ...dto.audience },
        recipientCount: recipients.length,
        createdById: actorId,
      },
    });

    await this.broadcastQueue.enqueueAll(broadcast.id, recipients);

    await this.auditLog.record({
      actorId,
      action: 'send_email_broadcast',
      targetType: 'email_broadcast',
      targetId: broadcast.id,
      metadata: {
        subject: content.subject,
        recipientCount: recipients.length,
      },
    });

    return { id: broadcast.id, recipientCount: recipients.length };
  }

  async list(eventSlug: string) {
    const event = await this.findEvent(eventSlug);
    const broadcasts = await this.prisma.emailBroadcast.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const creatorIds = [...new Set(broadcasts.map((b) => b.createdById))];
    const creators = await this.prisma.adminUser.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(creators.map((c) => [c.id, c.name]));

    return broadcasts.map((b) => ({
      ...b,
      createdByName: nameById.get(b.createdById) ?? null,
    }));
  }
}
