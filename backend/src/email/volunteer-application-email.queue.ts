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
import { VOLUNTEER_TEAM_LABELS, VolunteerTeam } from './labels';

const QUEUE_NAME = 'volunteer-application-emails';

type VolunteerApplicationEmailKind = 'received' | 'approved' | 'rejected';

interface VolunteerApplicationEmailJobData {
  applicationId: string;
  kind: VolunteerApplicationEmailKind;
  reason?: string;
}

// Same reliability rationale as the other application-email queues: never
// block the request path (public submission, or an organizer's
// approve/reject click) on an outbound SMTP call.
@Injectable()
export class VolunteerApplicationEmailQueue
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(VolunteerApplicationEmailQueue.name);
  private connection!: IORedis;
  private queue!: Queue<VolunteerApplicationEmailJobData>;
  private worker!: Worker<VolunteerApplicationEmailJobData>;

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
    this.worker = new Worker<VolunteerApplicationEmailJobData>(
      QUEUE_NAME,
      (job) => this.process(job),
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Volunteer application email job ${job?.id} failed: ${err.message}`,
      );
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
    this.connection.disconnect();
  }

  async enqueue(
    applicationId: string,
    kind: VolunteerApplicationEmailKind,
    reason?: string,
  ) {
    await this.queue.add('send', { applicationId, kind, reason });
  }

  private async process(job: Job<VolunteerApplicationEmailJobData>) {
    const application =
      await this.prisma.volunteerApplication.findUniqueOrThrow({
        where: { id: job.data.applicationId },
        include: { event: true },
      });

    const formData = application.formDataJson as { team?: string };
    const team = formData.team as VolunteerTeam | undefined;

    const data = {
      fullName: application.fullName,
      teamLabel: team ? VOLUNTEER_TEAM_LABELS[team] : 'volunteer team',
      eventName: application.event.name,
      supportEmail: this.config.getOrThrow<string>('SUPPORT_EMAIL'),
      reason: job.data.reason,
    };

    switch (job.data.kind) {
      case 'received':
        await this.emailService.sendVolunteerApplicationReceivedEmail(
          application.email,
          data,
        );
        break;
      case 'approved':
        await this.emailService.sendVolunteerApplicationApprovedEmail(
          application.email,
          data,
        );
        break;
      case 'rejected':
        await this.emailService.sendVolunteerApplicationRejectedEmail(
          application.email,
          data,
        );
        break;
    }
  }
}
