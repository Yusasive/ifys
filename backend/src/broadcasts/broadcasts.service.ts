import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
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
import {
  isValidUnsubscribe,
  normalizeEmail,
  unsubscribeLinks,
} from '../email/unsubscribe-links';
import { WHATSAPP_INVITE_EMAIL } from '../email/whatsapp-invite-email-template';
import { PrismaService } from '../prisma/prisma.service';
import { broadcastAudienceWhere } from './broadcast-audience-where';
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
  // de-duplicated case-insensitively — nobody gets the same email twice —
  // and anyone who unsubscribed from broadcasts is left out.
  private async resolveRecipients(
    eventId: string,
    audience: BroadcastAudienceDto,
  ): Promise<Recipient[]> {
    const where = broadcastAudienceWhere(eventId, audience);

    const registrations = await this.prisma.registration.findMany({
      where,
      select: { attendee: { select: { email: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const unsubscribed = new Set(
      (
        await this.prisma.emailUnsubscribe.findMany({ select: { email: true } })
      ).map((u) => u.email),
    );

    const byEmail = new Map<string, Recipient>();
    for (const { attendee } of registrations) {
      const key = normalizeEmail(attendee.email);
      if (!byEmail.has(key) && !unsubscribed.has(key)) {
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
      unsubscribe: unsubscribeLinks(
        admin.email,
        this.config.getOrThrow<string>('FRONTEND_ORIGIN'),
        this.config.getOrThrow<string>('JWT_SECRET'),
      ),
    });
    return { sentTo: admin.email };
  }

  // Idempotent: unsubscribing twice is still a success.
  async unsubscribe(email: string, token: string) {
    if (
      !isValidUnsubscribe(
        email,
        token,
        this.config.getOrThrow<string>('JWT_SECRET'),
      )
    ) {
      throw new UnauthorizedException('This unsubscribe link is not valid.');
    }
    const key = normalizeEmail(email);
    await this.prisma.emailUnsubscribe.upsert({
      where: { email: key },
      create: { email: key },
      update: {},
    });
    return { unsubscribed: true };
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

  // Recipients whose email still failed after every retry, with the reason.
  async listFailures(broadcastId: string) {
    await this.prisma.emailBroadcast
      .findUniqueOrThrow({
        where: { id: broadcastId },
      })
      .catch(() => {
        throw new NotFoundException('Broadcast not found');
      });
    return this.prisma.emailBroadcastFailure.findMany({
      where: { broadcastId },
      select: { email: true, fullName: true, error: true, failedAt: true },
      orderBy: { failedAt: 'asc' },
    });
  }

  // Re-queues the same message to everyone it failed for. Their failure
  // rows are removed and failedCount drops back, so they show as "sending"
  // again and are re-recorded if they fail a second time. Queuing happens
  // inside the transaction: if it throws, the failures are kept.
  async resendFailed(broadcastId: string, actorId: string) {
    const recipients = await this.prisma.$transaction(async (tx) => {
      const failures = await tx.emailBroadcastFailure.findMany({
        where: { broadcastId },
      });
      if (failures.length === 0) {
        throw new BadRequestException(
          'There are no failed recipients to resend to.',
        );
      }
      const deleted = await tx.emailBroadcastFailure.deleteMany({
        where: { id: { in: failures.map((f) => f.id) } },
      });
      if (deleted.count !== failures.length) {
        throw new ConflictException(
          'A resend for these recipients is already in progress.',
        );
      }
      await tx.emailBroadcast.update({
        where: { id: broadcastId },
        data: { failedCount: { decrement: failures.length } },
      });
      const list = failures.map((f) => ({
        email: f.email,
        fullName: f.fullName,
      }));
      await this.broadcastQueue.enqueueAll(broadcastId, list);
      return list;
    });

    await this.auditLog.record({
      actorId,
      action: 'resend_email_broadcast_failures',
      targetType: 'email_broadcast',
      targetId: broadcastId,
      metadata: { recipientCount: recipients.length },
    });

    return { recipientCount: recipients.length };
  }

  // The automatic "join the WhatsApp group" email sent with every newly
  // issued ticket (WhatsAppInviteEmailQueue), and its fixed wording.
  async getWhatsAppInvite(eventSlug: string) {
    const event = await this.findEvent(eventSlug);
    return {
      whatsappGroupUrl: event.whatsappGroupUrl,
      ...WHATSAPP_INVITE_EMAIL,
    };
  }

  // Setting the link turns the automatic invite on for tickets issued from
  // now on; people who already have a ticket are caught up from the
  // Tickets page's delivery panel. null turns it off.
  async updateWhatsAppInvite(
    eventSlug: string,
    whatsappGroupUrl: string | null,
    actorId: string,
  ) {
    const event = await this.findEvent(eventSlug);
    const url = whatsappGroupUrl?.trim() || null;
    await this.prisma.event.update({
      where: { id: event.id },
      data: { whatsappGroupUrl: url },
    });
    await this.auditLog.record({
      actorId,
      action: 'update_whatsapp_group_url',
      targetType: 'event',
      targetId: event.id,
      metadata: { from: event.whatsappGroupUrl, to: url },
    });
    return this.getWhatsAppInvite(eventSlug);
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
