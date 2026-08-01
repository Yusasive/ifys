import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const QUEUE_NAME = 'admin-export';

interface ExportJobResult {
  downloadUrl: string;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(
  rows: Record<string, string | number | null>[],
  columns: string[],
): string {
  const header = columns.join(',');
  const body = rows
    .map((row) =>
      columns.map((col) => csvEscape(String(row[col] ?? ''))).join(','),
    )
    .join('\n');
  return `${header}\n${body}\n`;
}

// TRD §9: CSV export is a background job, not a synchronous request — it
// runs through the same Redis-backed queue as ticket emails.
@Injectable()
export class ExportQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExportQueue.name);
  private connection!: IORedis;
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  onModuleInit() {
    this.connection = new IORedis(this.config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
    this.worker = new Worker(QUEUE_NAME, () => this.process(), {
      connection: this.connection,
    });
    this.worker.on('failed', (job, err) => {
      this.logger.error(`Export job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
    this.connection.disconnect();
  }

  async enqueue(): Promise<string> {
    const job = await this.queue.add('export', {});
    return job.id!;
  }

  async getStatus(
    jobId: string,
  ): Promise<{ state: string; downloadUrl?: string }> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return { state: 'not_found' };
    }
    const state = await job.getState();
    if (state === 'completed') {
      const result = job.returnvalue as ExportJobResult;
      return { state, downloadUrl: result.downloadUrl };
    }
    return { state };
  }

  private async process(): Promise<ExportJobResult> {
    const registrations = await this.prisma.registration.findMany({
      include: {
        attendee: true,
        ticketProduct: true,
        ticket: true,
        order: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const columns = [
      'registrationId',
      'fullName',
      'email',
      'phone',
      'category',
      'tier',
      'status',
      'amountKobo',
      'ticketCode',
      'ticketStatus',
      'createdAt',
    ];

    const rows = registrations.map((r) => ({
      registrationId: r.id,
      fullName: r.attendee.fullName,
      email: r.attendee.email,
      phone: r.attendee.phone,
      category: r.ticketProduct.category,
      tier: r.ticketProduct.tier,
      status: r.status,
      amountKobo: r.order?.amountKobo ?? null,
      ticketCode: r.ticket?.ticketCode ?? null,
      ticketStatus: r.ticket?.status ?? null,
      createdAt: r.createdAt.toISOString(),
    }));

    const csv = toCsv(rows, columns);
    const key = `exports/registrations-${randomUUID()}.csv`;
    await this.storage.putObject(key, csv, 'text/csv');
    const downloadUrl = await this.storage.getDownloadUrl(key);

    return { downloadUrl };
  }
}
