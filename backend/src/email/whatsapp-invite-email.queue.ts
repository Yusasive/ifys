import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_JOB_OPTIONS } from './email-job-options';
import { EmailService } from './email.service';
import { WHATSAPP_INVITE_EMAIL } from './whatsapp-invite-email-template';

const QUEUE_NAME = 'whatsapp-invite-emails';

interface WhatsAppInviteEmailJobData {
  ticketId: string;
}

@Injectable()
export class WhatsAppInviteEmailQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppInviteEmailQueue.name);
  private connection!: IORedis;
  private queue!: Queue<WhatsAppInviteEmailJobData>;
  private worker!: Worker<WhatsAppInviteEmailJobData>;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit() {
    this.connection = new IORedis(this.config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue(QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: EMAIL_JOB_OPTIONS,
    });
    this.worker = new Worker<WhatsAppInviteEmailJobData>(
      QUEUE_NAME,
      (job) => this.process(job),
      {
        connection: this.connection,
        // A "send to everyone not yet sent" can be hundreds of emails —
        // drip-fed like broadcasts so Gmail doesn't throttle them.
        limiter: { max: 2, duration: 1000 },
      },
    );
    this.worker.on('failed', (job, err) => {
      if (!job) {
        this.logger.error(`WhatsApp invite email job failed: ${err.message}`);
        return;
      }
      const attempts = job.opts.attempts ?? 1;
      const final = job.attemptsMade >= attempts;
      this.logger.error(
        `WhatsApp invite email job ${job.id} (ticket ${job.data.ticketId}) failed on attempt ${job.attemptsMade}/${attempts}${final ? ', giving up' : ', will retry'}: ${err.message}`,
      );
      void this.track(job.data.ticketId, {
        status: final ? 'failed' : 'queued',
        error: err.message,
      });
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
    this.connection.disconnect();
  }

  // Delivery tracking is best-effort: a database hiccup here must never
  // fail (and so re-send) an email that already went out.
  private async track(
    ticketId: string,
    update: {
      status: 'queued' | 'sent' | 'failed';
      error: string | null;
      sentAt?: Date;
    },
  ) {
    const kind = 'whatsapp_invite' as const;
    try {
      await this.prisma.ticketEmailDelivery.upsert({
        where: { ticketId_kind: { ticketId, kind } },
        create: { ticketId, kind, ...update },
        update,
      });
    } catch (e) {
      // P2003: the ticket was deleted while its email was in flight.
      if ((e as { code?: string }).code === 'P2003') return;
      this.logger.error(
        `Could not record WhatsApp invite status for ticket ${ticketId}: ${String(e)}`,
      );
    }
  }

  async enqueue(ticketId: string) {
    await this.track(ticketId, { status: 'queued', error: null });
    await this.queue.add('send', { ticketId });
  }

  async enqueueForNewTicket(ticketId: string) {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: {
          registration: {
            select: { event: { select: { whatsappGroupUrl: true } } },
          },
          emailDeliveries: { where: { kind: 'whatsapp_invite' } },
        },
      });
      if (!ticket?.registration.event.whatsappGroupUrl) return;
      const status = ticket.emailDeliveries[0]?.status;
      if (status === 'sent' || status === 'queued') return;
      await this.enqueue(ticketId);
    } catch (e) {
      this.logger.error(
        `Could not queue WhatsApp invite for ticket ${ticketId}: ${String(e)}`,
      );
    }
  }

  private async process(job: Job<WhatsAppInviteEmailJobData>) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: job.data.ticketId },
      include: { registration: { include: { attendee: true, event: true } } },
    });
    if (!ticket) {
      this.logger.warn(
        `Ticket ${job.data.ticketId} no longer exists; skipping WhatsApp invite job ${job.id}`,
      );
      return;
    }
    const { attendee, event } = ticket.registration;
    if (!event.whatsappGroupUrl) {
      throw new Error('No WhatsApp group link is set for this event.');
    }

    await this.emailService.sendBroadcastEmail(attendee.email, {
      ...WHATSAPP_INVITE_EMAIL,
      ctaUrl: event.whatsappGroupUrl,
      recipientName: attendee.fullName,
      eventName: event.name,
      supportEmail: this.config.getOrThrow<string>('SUPPORT_EMAIL'),
    });

    await this.track(job.data.ticketId, {
      status: 'sent',
      error: null,
      sentAt: new Date(),
    });
  }
}
