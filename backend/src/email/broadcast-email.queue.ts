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
import { unsubscribeLinks } from './unsubscribe-links';

const QUEUE_NAME = 'broadcast-emails';

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
        // Hosted SMTP (Gmail) throttles bursts — a broadcast to every
        // registrant is drip-fed rather than fired all at once.
        limiter: { max: 2, duration: 1000 },
      },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Broadcast email job ${job?.id} (broadcast ${job?.data.broadcastId}, to ${job?.data.email}) failed on attempt ${job?.attemptsMade}/${job?.opts.attempts ?? 1}: ${err.message}`,
      );
      if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        void this.recordFailure(job, err.message);
      }
    });

    void this.backfillFailures();
  }

  // Out of retries: remember who it was so an admin can resend to them,
  // then drop the job — the failure row now holds everything it did.
  private async recordFailure(job: Job<BroadcastEmailJobData>, error: string) {
    const { broadcastId, email, fullName } = job.data;
    try {
      await this.prisma.$transaction([
        this.prisma.emailBroadcastFailure.createMany({
          data: [{ broadcastId, email, fullName, error }],
          skipDuplicates: true,
        }),
        this.prisma.emailBroadcast.update({
          where: { id: broadcastId },
          data: { failedCount: { increment: 1 } },
        }),
      ]);
      await job.remove();
    } catch (e) {
      this.logger.error(
        `Could not record failure for broadcast ${broadcastId} (${email}): ${String(e)}`,
      );
    }
  }

  private async backfillFailures() {
    try {
      const failed = (await this.queue.getFailed()).filter(
        (job) => job.attemptsMade >= (job.opts.attempts ?? 1),
      );
      if (failed.length === 0) return;

      const existing = await this.prisma.emailBroadcast.findMany({
        where: {
          id: { in: [...new Set(failed.map((j) => j.data.broadcastId))] },
        },
        select: { id: true },
      });
      const known = new Set(existing.map((b) => b.id));
      const jobs = failed.filter((j) => known.has(j.data.broadcastId));

      await this.prisma.emailBroadcastFailure.createMany({
        data: jobs.map((j) => ({
          broadcastId: j.data.broadcastId,
          email: j.data.email,
          fullName: j.data.fullName,
          error: j.failedReason || 'Unknown error',
        })),
        skipDuplicates: true,
      });
      await Promise.all(jobs.map((j) => j.remove()));
      this.logger.log(
        `Backfilled ${jobs.length} failed broadcast recipient(s) from Redis`,
      );
    } catch (e) {
      this.logger.error(`Could not backfill broadcast failures: ${String(e)}`);
    }
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
        opts: EMAIL_JOB_OPTIONS,
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
      unsubscribe: unsubscribeLinks(
        job.data.email,
        this.config.getOrThrow<string>('FRONTEND_ORIGIN'),
        this.config.getOrThrow<string>('JWT_SECRET'),
      ),
    });

    await this.prisma.emailBroadcast.update({
      where: { id: broadcast.id },
      data: { sentCount: { increment: 1 } },
    });
  }
}
