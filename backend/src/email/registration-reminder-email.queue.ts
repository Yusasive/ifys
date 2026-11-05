import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { CATEGORY_LABELS, TIER_LABELS } from './labels';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

const QUEUE_NAME = 'registration-reminder-emails';

export const PENDING_PAYMENT_REMINDER_DELAY_MS = 24 * 60 * 60 * 1000;

interface RegistrationReminderEmailJobData {
  registrationId: string;
}

@Injectable()
export class RegistrationReminderEmailQueue
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RegistrationReminderEmailQueue.name);
  private connection!: IORedis;
  private queue!: Queue<RegistrationReminderEmailJobData>;
  private worker!: Worker<RegistrationReminderEmailJobData>;

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
    this.worker = new Worker<RegistrationReminderEmailJobData>(
      QUEUE_NAME,
      (job) => this.process(job),
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Registration reminder email job ${job?.id} failed: ${err.message}`,
      );
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
    this.connection.disconnect();
  }

  async enqueue(
    registrationId: string,
    opts?: { delayMs?: number; jobId?: string },
  ) {
    await this.queue.add(
      'send',
      { registrationId },
      opts?.delayMs || opts?.jobId
        ? {
            ...(opts.delayMs ? { delay: opts.delayMs } : {}),
            ...(opts.jobId ? { jobId: opts.jobId } : {}),
          }
        : undefined,
    );
  }

  private async process(job: Job<RegistrationReminderEmailJobData>) {
    const registration = await this.prisma.registration.findUniqueOrThrow({
      where: { id: job.data.registrationId },
      include: { attendee: true, ticketProduct: true, event: true },
    });

    if (registration.status !== 'pending_payment') {
      this.logger.debug(
        `Skipping reminder for registration ${registration.id}: status is ${registration.status}, not pending_payment`,
      );
      return;
    }

    const resumeUrl = `${this.config.getOrThrow<string>('FRONTEND_ORIGIN')}/register/confirmation?registration=${registration.id}&token=${registration.lookupToken}`;

    await this.emailService.sendRegistrationPendingPaymentReminderEmail(
      registration.attendee.email,
      {
        fullName: registration.attendee.fullName,
        eventName: registration.event.name,
        categoryLabel: CATEGORY_LABELS[registration.ticketProduct.category],
        tierLabel: TIER_LABELS[registration.ticketProduct.tier],
        resumeUrl,
        supportEmail: this.config.getOrThrow<string>('SUPPORT_EMAIL'),
      },
    );

    await this.prisma.registration.update({
      where: { id: registration.id },
      data: { pendingPaymentReminderSentAt: new Date() },
    });
  }
}
