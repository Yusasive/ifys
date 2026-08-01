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
import { EmailService } from './email.service';
import { CATEGORY_LABELS, TIER_LABELS } from './labels';

const QUEUE_NAME = 'ticket-emails';

interface TicketEmailJobData {
  ticketId: string;
}

// TRD §2: Redis-backed job queue so ticket email/QR generation never
// blocks the payment webhook response. The worker runs in-process for
// M2 — splitting it into a separate worker process is a deploy-topology
// change, not a code change, if load ever requires it.
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
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
    this.worker = new Worker<TicketEmailJobData>(
      QUEUE_NAME,
      (job) => this.process(job),
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`Ticket email job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
    this.connection.disconnect();
  }

  async enqueue(ticketId: string) {
    await this.queue.add('send', { ticketId });
  }

  private async process(job: Job<TicketEmailJobData>) {
    const ticket = await this.prisma.ticket.findUniqueOrThrow({
      where: { id: job.data.ticketId },
      include: {
        registration: {
          include: { attendee: true, ticketProduct: true, event: true },
        },
      },
    });
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
        // No fallback: an event-day ticket must carry a real support
        // contact, not a placeholder nobody reads (M6 exit criteria).
        supportEmail: this.config.getOrThrow<string>('SUPPORT_EMAIL'),
      },
      ticket.qrSecret,
    );
  }
}
