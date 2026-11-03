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

const QUEUE_NAME = 'certificate-emails';
const DISPATCH_JOB_ID = 'certificate-dispatch';

// 00:01 on 6 November 2026, Nigeria time (WAT, UTC+1) — the day after the
// summit. Override with CERTIFICATE_SEND_AT (an ISO timestamp with offset).
const DEFAULT_SEND_AT = '2026-11-06T00:01:00+01:00';

// A deploy that lands long after the send time must not blast certificates
// out the moment it boots.
const MAX_LATE_MS = 24 * 60 * 60 * 1000;

type CertificateEmailJob =
  { kind: 'dispatch' } | { kind: 'send'; ticketId: string };

// Certificates go to everyone successfully registered — a paid registration
// with a live ticket, in any category — whether or not they were checked in.
// Same rule as the registrant name tags: students still awaiting ID review
// have no ticket yet, and voided tickets are left out.
export function registeredTicketWhere(eventId: string) {
  return {
    status: { not: 'void' as const },
    registration: { eventId, status: 'paid' as const },
  };
}

// Emails each registered attendee their certificate PDF, automatically at
// the configured time. Each outcome is recorded as the ticket's `certificate`
// TicketEmailDelivery row, which also keeps a repeat dispatch from emailing
// anyone twice.
@Injectable()
export class CertificateEmailQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CertificateEmailQueue.name);
  private connection!: IORedis;
  private queue!: Queue<CertificateEmailJob>;
  private worker!: Worker<CertificateEmailJob>;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  get sendAt(): Date {
    return new Date(
      this.config.get<string>('CERTIFICATE_SEND_AT') ?? DEFAULT_SEND_AT,
    );
  }

  async onModuleInit() {
    this.connection = new IORedis(this.config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue(QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: EMAIL_JOB_OPTIONS,
    });
    this.worker = new Worker<CertificateEmailJob>(
      QUEUE_NAME,
      (job) => this.process(job),
      {
        connection: this.connection,
        // Hundreds of PDFs: drip-fed like the other bulk emails.
        limiter: { max: 2, duration: 1000 },
      },
    );
    this.worker.on('failed', (job, err) => {
      if (!job) {
        this.logger.error(`Certificate email job failed: ${err.message}`);
        return;
      }
      const attempts = job.opts.attempts ?? 1;
      const final = job.attemptsMade >= attempts;
      this.logger.error(
        `Certificate email job ${job.id} failed on attempt ${job.attemptsMade}/${attempts}${final ? ', giving up' : ', will retry'}: ${err.message}`,
      );
      if (job.data.kind === 'send') {
        void this.track(job.data.ticketId, {
          status: final ? 'failed' : 'queued',
          error: err.message,
        });
      }
    });

    await this.scheduleDispatch();
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
    this.connection.disconnect();
  }

  // One delayed job, with a fixed id so every app instance and every restart
  // schedules the same single job instead of adding another.
  private async scheduleDispatch() {
    const sendAt = this.sendAt;
    if (Number.isNaN(sendAt.getTime())) {
      this.logger.error(
        'CERTIFICATE_SEND_AT is not a valid date; certificates will not be sent automatically.',
      );
      return;
    }
    const delay = sendAt.getTime() - Date.now();
    if (delay < -MAX_LATE_MS) {
      this.logger.warn(
        `Certificate send time ${sendAt.toISOString()} is long past; not scheduling.`,
      );
      return;
    }
    await this.queue.add(
      'dispatch',
      { kind: 'dispatch' },
      { jobId: DISPATCH_JOB_ID, delay: Math.max(0, delay), attempts: 3 },
    );
    this.logger.log(
      `Certificates are scheduled to be emailed at ${sendAt.toISOString()}.`,
    );
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
    const kind = 'certificate' as const;
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
        `Could not record certificate status for ticket ${ticketId}: ${String(e)}`,
      );
    }
  }

  // Queues every registered ticket that hasn't been sent (or isn't already
  // being sent) a certificate. Returns how many were queued.
  async dispatchForEvent(eventSlug: string): Promise<number> {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
    });
    if (!event) throw new Error(`No event found for slug "${eventSlug}"`);

    const tickets = await this.prisma.ticket.findMany({
      where: {
        ...registeredTicketWhere(event.id),
        NOT: {
          emailDeliveries: {
            some: { kind: 'certificate', status: { in: ['sent', 'queued'] } },
          },
        },
      },
      select: { id: true },
    });
    for (const { id: ticketId } of tickets) {
      await this.track(ticketId, { status: 'queued', error: null });
      await this.queue.add(
        'send',
        { kind: 'send', ticketId },
        { jobId: `certificate-${ticketId}` },
      );
    }
    this.logger.log(
      `Queued ${tickets.length} certificate email(s) for ${eventSlug}.`,
    );
    return tickets.length;
  }

  private async process(job: Job<CertificateEmailJob>) {
    if (job.data.kind === 'dispatch') {
      await this.dispatchForEvent(
        this.config.get<string>('EVENT_SLUG') ?? 'ify-summit-2026',
      );
      return;
    }

    const { ticketId } = job.data;
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { registration: { include: { attendee: true, event: true } } },
    });
    if (!ticket) {
      this.logger.warn(
        `Ticket ${ticketId} no longer exists; skipping certificate job ${job.id}`,
      );
      return;
    }
    // Re-checked at send time: a ticket voided since it was queued gets none.
    if (ticket.status === 'void') {
      await this.track(ticketId, {
        status: 'failed',
        error: 'Ticket was voided.',
      });
      return;
    }
    const { attendee, event } = ticket.registration;
    await this.emailService.sendCertificateEmail(attendee.email, {
      recipientName: attendee.fullName,
      eventName: event.name,
      supportEmail: this.config.getOrThrow<string>('SUPPORT_EMAIL'),
    });
    await this.track(ticketId, {
      status: 'sent',
      error: null,
      sentAt: new Date(),
    });
  }
}
