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

const QUEUE_NAME = 'student-review-emails';

type StudentReviewJobData =
  | {
      type: 'attendee';
      registrationId: string;
      kind: 'pending' | 'rejected';
      reason?: string;
    }
  | { type: 'admin_notify'; registrationId: string };

// Same reliability rationale as the other application-email queues: never
// block the request path (Paystack webhook settlement, or an organizer's
// approve/reject click) on an outbound SMTP call. Also fans a single
// admin-notify job out to every admin flagged for it, rather than the
// caller having to know the recipient list.
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
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
    this.worker = new Worker<StudentReviewJobData>(
      QUEUE_NAME,
      (job) => this.process(job),
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Student review email job ${job?.id} failed: ${err.message}`,
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

    const admins = await this.prisma.adminUser.findMany({
      where: { notifyOnStudentRegistration: true },
      select: { email: true },
    });
    const reviewUrl = `${this.config.getOrThrow<string>('FRONTEND_ORIGIN')}/admin/registrations/${registration.id}`;
    for (const admin of admins) {
      await this.emailService.sendStudentReviewAdminNotifyEmail(admin.email, {
        eventName: registration.event.name,
        supportEmail,
        attendeeName: registration.attendee.fullName,
        reviewUrl,
      });
    }
  }
}
