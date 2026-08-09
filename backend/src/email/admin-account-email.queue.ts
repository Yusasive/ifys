import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { AdminRole } from '../generated/prisma/enums';
import { ADMIN_ROLE_LABELS } from './labels';
import { EmailService } from './email.service';

const QUEUE_NAME = 'admin-account-emails';

interface AdminAccountEmailJobData {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
}

// Same reliability rationale as TicketEmailQueue: never block the request
// path — here, an already-privileged super_admin's POST /admin/users —
// on an outbound SMTP call that may be slow or unreachable. Unlike the
// other email queues, the job data carries a plaintext temp password
// (nothing else in this flow retains it — it's hashed immediately on
// create, never stored), so completed/failed jobs are dropped from Redis
// right away instead of the default keep-forever behavior.
@Injectable()
export class AdminAccountEmailQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminAccountEmailQueue.name);
  private connection!: IORedis;
  private queue!: Queue<AdminAccountEmailJobData>;
  private worker!: Worker<AdminAccountEmailJobData>;

  constructor(
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit() {
    this.connection = new IORedis(this.config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
    this.worker = new Worker<AdminAccountEmailJobData>(
      QUEUE_NAME,
      (job) => this.process(job),
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Admin account email job ${job?.id} failed: ${err.message}`,
      );
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
    this.connection.disconnect();
  }

  async enqueue(data: AdminAccountEmailJobData) {
    await this.queue.add('send', data, {
      removeOnComplete: true,
      removeOnFail: true,
    });
  }

  private async process(job: Job<AdminAccountEmailJobData>) {
    const { name, email, password, role } = job.data;
    await this.emailService.sendAdminAccountCreatedEmail(email, {
      name,
      email,
      password,
      roleLabel: ADMIN_ROLE_LABELS[role],
      loginUrl: `${this.config.getOrThrow<string>('FRONTEND_ORIGIN')}/admin/login`,
      supportEmail: this.config.getOrThrow<string>('SUPPORT_EMAIL'),
    });
  }
}
