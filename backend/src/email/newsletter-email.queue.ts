import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { EmailService } from './email.service';

const QUEUE_NAME = 'newsletter-emails';

interface NewsletterEmailJobData {
  email: string;
}

@Injectable()
export class NewsletterEmailQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NewsletterEmailQueue.name);
  private connection!: IORedis;
  private queue!: Queue<NewsletterEmailJobData>;
  private worker!: Worker<NewsletterEmailJobData>;

  constructor(
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit() {
    this.connection = new IORedis(this.config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
    this.worker = new Worker<NewsletterEmailJobData>(
      QUEUE_NAME,
      (job) => this.process(job),
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Newsletter email job ${job?.id} failed: ${err.message}`,
      );
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
    this.connection.disconnect();
  }

  async enqueue(email: string) {
    await this.queue.add('send', { email });
  }

  private async process(job: Job<NewsletterEmailJobData>) {
    await this.emailService.sendNewsletterConfirmationEmail(job.data.email, {
      supportEmail: this.config.getOrThrow<string>('SUPPORT_EMAIL'),
    });
  }
}
