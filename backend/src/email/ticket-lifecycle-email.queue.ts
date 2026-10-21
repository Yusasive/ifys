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
import { TicketLifecycleKind } from './ticket-lifecycle-email-template';

const QUEUE_NAME = 'ticket-lifecycle-emails';

interface TicketLifecycleEmailJobData {
  ticketId: string;
  kind: TicketLifecycleKind;
}

@Injectable()
export class TicketLifecycleEmailQueue
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TicketLifecycleEmailQueue.name);
  private connection!: IORedis;
  private queue!: Queue<TicketLifecycleEmailJobData>;
  private worker!: Worker<TicketLifecycleEmailJobData>;

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
    this.worker = new Worker<TicketLifecycleEmailJobData>(
      QUEUE_NAME,
      (job) => this.process(job),
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Ticket lifecycle email job ${job?.id} (${job?.data.kind}, ticket ${job?.data.ticketId}) failed on attempt ${job?.attemptsMade}/${job?.opts.attempts ?? 1}: ${err.message}`,
      );
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
    this.connection.disconnect();
  }

  async enqueue(ticketId: string, kind: TicketLifecycleKind) {
    await this.queue.add('send', { ticketId, kind });
  }

  private async process(job: Job<TicketLifecycleEmailJobData>) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: job.data.ticketId },
      include: { registration: { include: { attendee: true, event: true } } },
    });
    if (!ticket) {
      this.logger.warn(
        `Ticket ${job.data.ticketId} no longer exists; skipping lifecycle email job ${job.id}`,
      );
      return;
    }
    const { registration } = ticket;

    await this.emailService.sendTicketLifecycleEmail(
      registration.attendee.email,
      job.data.kind,
      {
        fullName: registration.attendee.fullName,
        eventName: registration.event.name,
        supportEmail: this.config.getOrThrow<string>('SUPPORT_EMAIL'),
      },
    );
  }
}
