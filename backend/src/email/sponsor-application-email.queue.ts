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
import { SPONSOR_TYPE_LABELS } from './labels';

const QUEUE_NAME = 'sponsor-application-emails';

type SponsorApplicationEmailKind = 'received' | 'approved' | 'rejected';

interface SponsorApplicationEmailJobData {
  applicationId: string;
  kind: SponsorApplicationEmailKind;
}

@Injectable()
export class SponsorApplicationEmailQueue
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SponsorApplicationEmailQueue.name);
  private connection!: IORedis;
  private queue!: Queue<SponsorApplicationEmailJobData>;
  private worker!: Worker<SponsorApplicationEmailJobData>;

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
    this.worker = new Worker<SponsorApplicationEmailJobData>(
      QUEUE_NAME,
      (job) => this.process(job),
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Sponsor application email job ${job?.id} failed: ${err.message}`,
      );
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
    this.connection.disconnect();
  }

  async enqueue(applicationId: string, kind: SponsorApplicationEmailKind) {
    await this.queue.add('send', { applicationId, kind });
  }

  private async process(job: Job<SponsorApplicationEmailJobData>) {
    const application = await this.prisma.sponsorApplication.findUniqueOrThrow({
      where: { id: job.data.applicationId },
      include: { event: true },
    });

    const data = {
      contactName: application.contactName,
      organizationName: application.organizationName,
      typeLabel: SPONSOR_TYPE_LABELS[application.type],
      eventName: application.event.name,
      supportEmail: this.config.getOrThrow<string>('SUPPORT_EMAIL'),
    };

    switch (job.data.kind) {
      case 'received':
        await this.emailService.sendSponsorApplicationReceivedEmail(
          application.email,
          data,
        );
        break;
      case 'approved':
        await this.emailService.sendSponsorApplicationApprovedEmail(
          application.email,
          data,
        );
        break;
      case 'rejected':
        await this.emailService.sendSponsorApplicationRejectedEmail(
          application.email,
          data,
        );
        break;
    }
  }
}
