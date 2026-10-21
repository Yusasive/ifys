import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { TicketEmailKind } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_JOB_OPTIONS } from './email-job-options';
import { EmailService } from './email.service';
import { CATEGORY_LABELS, TIER_LABELS } from './labels';
import { TicketEmailVariant } from './ticket-email-template';

const QUEUE_NAME = 'ticket-emails';

export function ticketEmailKind(variant: TicketEmailVariant): TicketEmailKind {
  return variant === 'date_updated' ? 'date_update' : 'ticket';
}

interface TicketEmailJobData {
  ticketId: string;
  variant: TicketEmailVariant;
}

@Injectable()
export class TicketEmailQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TicketEmailQueue.name);
  private connection!: IORedis;
  private queue!: Queue<TicketEmailJobData>;
  private worker!: Worker<TicketEmailJobData>;

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
    this.worker = new Worker<TicketEmailJobData>(
      QUEUE_NAME,
      (job) => this.process(job),
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) => {
      if (!job) {
        this.logger.error(`Ticket email job failed: ${err.message}`);
        return;
      }
      const attempts = job.opts.attempts ?? 1;
      const final = job.attemptsMade >= attempts;
      this.logger.error(
        `Ticket email job ${job.id} (${job.data.variant}, ticket ${job.data.ticketId}) failed on attempt ${job.attemptsMade}/${attempts}${final ? ', giving up' : ', will retry'}: ${err.message}`,
      );
      void this.track(job.data, {
        status: final ? 'failed' : 'queued',
        error: err.message,
      });
    });

    void this.backfillDeliveries();
  }

  // Delivery tracking is best-effort: a database hiccup here must never
  // fail (and so re-send) an email that already went out.
  private async track(
    data: TicketEmailJobData,
    update: {
      status: 'queued' | 'sent' | 'failed';
      error: string | null;
      sentAt?: Date;
    },
  ) {
    const kind = ticketEmailKind(data.variant);
    try {
      await this.prisma.ticketEmailDelivery.upsert({
        where: { ticketId_kind: { ticketId: data.ticketId, kind } },
        create: { ticketId: data.ticketId, kind, ...update },
        update,
      });
    } catch (e) {
      // P2003: the ticket was deleted while its email was in flight, so
      // there is nothing left to record against.
      if ((e as { code?: string }).code === 'P2003') return;
      this.logger.error(
        `Could not record ${kind} email status for ticket ${data.ticketId}: ${String(e)}`,
      );
    }
  }

  // Before delivery tracking existed, this queue never cleared finished
  // jobs, so Redis still knows which ticket emails went out and which
  // failed. Fill in tickets that have no delivery row yet from the latest
  // such job; rows written since tracking began always win.
  private async backfillDeliveries() {
    try {
      const jobs = (await this.queue.getJobs(['completed', 'failed']))
        .filter((job) => job?.data?.ticketId && job.finishedOn)
        .sort((a, b) => a.finishedOn! - b.finishedOn!);
      if (jobs.length === 0) return;

      const latest = new Map<string, Job<TicketEmailJobData>>();
      for (const job of jobs) {
        latest.set(
          `${job.data.ticketId}:${ticketEmailKind(job.data.variant)}`,
          job,
        );
      }
      const existing = await this.prisma.ticket.findMany({
        where: { id: { in: [...new Set(jobs.map((j) => j.data.ticketId))] } },
        select: { id: true },
      });
      const known = new Set(existing.map((t) => t.id));

      const { count } = await this.prisma.ticketEmailDelivery.createMany({
        data: [...latest.values()]
          .filter((job) => known.has(job.data.ticketId))
          .map((job) => {
            const failed = !!job.failedReason;
            return {
              ticketId: job.data.ticketId,
              kind: ticketEmailKind(job.data.variant),
              status: failed ? ('failed' as const) : ('sent' as const),
              error: failed ? job.failedReason : null,
              sentAt: failed ? null : new Date(job.finishedOn!),
            };
          }),
        skipDuplicates: true,
      });
      if (count > 0) {
        this.logger.log(
          `Backfilled ${count} ticket email status(es) from Redis`,
        );
      }
    } catch (e) {
      this.logger.error(
        `Could not backfill ticket email statuses: ${String(e)}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
    this.connection.disconnect();
  }

  async enqueue(ticketId: string, variant: TicketEmailVariant = 'issued') {
    await this.track({ ticketId, variant }, { status: 'queued', error: null });
    await this.queue.add('send', { ticketId, variant });
  }

  private async process(job: Job<TicketEmailJobData>) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: job.data.ticketId },
      include: {
        registration: {
          include: { attendee: true, ticketProduct: true, event: true },
        },
      },
    });
    if (!ticket) {
      this.logger.warn(
        `Ticket ${job.data.ticketId} no longer exists; skipping email job ${job.id}`,
      );
      return;
    }
    const { registration } = ticket;

    await this.emailService.sendTicketEmail(
      registration.attendee.email,
      {
        fullName: registration.attendee.fullName,
        categoryLabel: CATEGORY_LABELS[registration.ticketProduct.category],
        tierLabel: TIER_LABELS[registration.ticketProduct.tier],
        eventName: registration.event.name,
        venue: registration.event.venue,
        startsAt: registration.event.startsAt,
        ticketCode: ticket.ticketCode,
        ticketId: ticket.id,

        supportEmail: this.config.getOrThrow<string>('SUPPORT_EMAIL'),
        variant: job.data.variant,
      },
      ticket.qrSecret,
    );

    await this.track(job.data, {
      status: 'sent',
      error: null,
      sentAt: new Date(),
    });
  }
}
