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

const QUEUE_NAME = 'broadcast-emails';
const MAX_ATTEMPTS = 3;

interface BroadcastEmailJobData {
  broadcastId: string;
  email: string;
  fullName: string;
}

// One job per recipient, so a single bad address or SMTP hiccup only
// retries/fails that one recipient instead of the whole send.
@Injectable()
export class BroadcastEmailQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BroadcastEmailQueue.name);
  private connection!: IORedis;
  private queue!: Queue<BroadcastEmailJobData>;
  private worker!: Worker<BroadcastEmailJobData>;

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
    this.worker = new Worker<BroadcastEmailJobData>(
      QUEUE_NAME,
      (job) => this.process(job),
      {
        connection: this.connection,
        // Hosted SMTP (Zoho) throttles bursts — a broadcast to every
        // registrant is drip-fed rather than fired all at once.
        limiter: { max: 2, duration: 1000 },
      },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Broadcast email job ${job?.id} failed: ${err.message}`,
      );
      if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        void this.prisma.emailBroadcast
          .update({
            where: { id: job.data.broadcastId },
            data: { failedCount: { increment: 1 } },
          })
          .catch((e: unknown) =>
            this.logger.error(
              `Could not record failure for broadcast ${job.data.broadcastId}: ${String(e)}`,
            ),
          );
      }
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
    this.connection.disconnect();
  }

  async enqueueAll(
    broadcastId: string,
    recipients: { email: string; fullName: string }[],
  ) {
    await this.queue.addBulk(
      recipients.map((r) => ({
        name: 'send',
        data: { broadcastId, email: r.email, fullName: r.fullName },
        opts: {
          attempts: MAX_ATTEMPTS,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: true,
          removeOnFail: 1000,
        },
      })),
    );
  }

  private async process(job: Job<BroadcastEmailJobData>) {
    const broadcast = await this.prisma.emailBroadcast.findUniqueOrThrow({
      where: { id: job.data.broadcastId },
      include: { event: true },
    });

    await this.emailService.sendBroadcastEmail(job.data.email, {
      subject: broadcast.subject,
      bodyHtml: broadcast.bodyHtml,
      ctaLabel: broadcast.ctaLabel,
      ctaUrl: broadcast.ctaUrl,
      recipientName: job.data.fullName,
      eventName: broadcast.event.name,
      supportEmail: this.config.getOrThrow<string>('SUPPORT_EMAIL'),
    });

    await this.prisma.emailBroadcast.update({
      where: { id: broadcast.id },
      data: { sentCount: { increment: 1 } },
    });
  }
}
