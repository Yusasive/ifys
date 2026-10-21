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

const QUEUE_NAME = 'student-review-emails';

type StudentReviewJobData =
  | {
      type: 'attendee';
      registrationId: string;
      kind: 'pending' | 'rejected';
      reason?: string;
    }
  // Looks up the opted-in admins and fans out one admin_notify_one job each.
  | { type: 'admin_notify'; registrationId: string }
  // One email to one admin, so a failure for one recipient is retried on
  // its own and never blocks or duplicates the others.
  | { type: 'admin_notify_one'; registrationId: string; email: string };

@Injectable()
export class StudentReviewEmailQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StudentReviewEmailQueue.name);
  private connection!: IORedis;
  private queue!: Queue<StudentReviewJobData>;
  private worker!: Worker<StudentReviewJobData>;

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
    this.worker = new Worker<StudentReviewJobData>(
      QUEUE_NAME,
      (job) => this.process(job),
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) => {
      if (!job) {
        this.logger.error(`Student review email job failed: ${err.message}`);
        return;
      }
      const attempts = job.opts.attempts ?? 1;
      const final = job.attemptsMade >= attempts;
      const target =
        job.data.type === 'admin_notify_one'
          ? ` to admin ${job.data.email}`
          : '';
      this.logger.error(
        `Student review email job ${job.id} (${job.data.type}${target}, registration ${job.data.registrationId}) failed on attempt ${job.attemptsMade}/${attempts}${final ? ', giving up' : ', will retry'}: ${err.message}`,
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
    kind: 'pending' | 'rejected',
    reason?: string,
  ) {
    await this.queue.add('send', {
      type: 'attendee',
      registrationId,
      kind,
      reason,
    });
  }

  async enqueueAdminNotify(registrationId: string) {
    await this.queue.add('send', { type: 'admin_notify', registrationId });
  }

  private async process(job: Job<StudentReviewJobData>) {
    if (job.data.type === 'admin_notify') {
      await this.fanOutAdminNotify(job.data.registrationId);
      return;
    }

    const registration = await this.prisma.registration.findUniqueOrThrow({
      where: { id: job.data.registrationId },
      include: { attendee: true, event: true },
    });
    const supportEmail = this.config.getOrThrow<string>('SUPPORT_EMAIL');

    if (job.data.type === 'attendee') {
      const data = {
        fullName: registration.attendee.fullName,
        eventName: registration.event.name,
        supportEmail,
        reason: job.data.reason,
      };
      if (job.data.kind === 'pending') {
        await this.emailService.sendStudentRegistrationPendingEmail(
          registration.attendee.email,
          data,
        );
      } else {
        await this.emailService.sendStudentRegistrationRejectedEmail(
          registration.attendee.email,
          data,
        );
      }
      return;
    }

    const reviewUrl = `${this.config.getOrThrow<string>('FRONTEND_ORIGIN')}/admin/registrations/${registration.id}`;
    await this.emailService.sendStudentReviewAdminNotifyEmail(job.data.email, {
      eventName: registration.event.name,
      supportEmail,
      attendeeName: registration.attendee.fullName,
      reviewUrl,
    });
  }

  private async fanOutAdminNotify(registrationId: string) {
    const admins = await this.prisma.adminUser.findMany({
      where: { notifyOnStudentRegistration: true },
      select: { id: true, email: true },
    });

    if (admins.length === 0) {
      this.logger.warn(
        `Student registration ${registrationId} is awaiting review but no admin has student review notifications turned on, so nobody was emailed`,
      );
      return;
    }

    await this.queue.addBulk(
      admins.map((admin) => ({
        name: 'send',
        data: {
          type: 'admin_notify_one' as const,
          registrationId,
          email: admin.email,
        },
        // Deterministic id: if this fan-out job is retried, admins already
        // queued are not queued (and emailed) a second time.
        opts: { jobId: `admin-notify-${registrationId}-${admin.id}` },
      })),
    );
    this.logger.log(
      `Queued student review notification for registration ${registrationId} to ${admins.length} admin(s)`,
    );
  }
}
