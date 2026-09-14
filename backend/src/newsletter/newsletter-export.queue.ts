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

const QUEUE_NAME = 'newsletter-export';

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

@Injectable()
export class NewsletterExportQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NewsletterExportQueue.name);
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
      this.logger.error(
        `Newsletter export job ${job?.id} failed: ${err.message}`,
      );
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
    const subscribers = await this.prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const columns = ['email', 'createdAt'];
    const rows = subscribers.map((s) => ({
      email: s.email,
      createdAt: s.createdAt.toISOString(),
    }));

    const csv = toCsv(rows, columns);
    const key = `exports/newsletter-${randomUUID()}.csv`;
    await this.storage.putObject(key, csv, 'text/csv');
    const downloadUrl = await this.storage.getDownloadUrl(key);

    return { downloadUrl };
  }
}
