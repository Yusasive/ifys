import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NewsletterEmailQueue } from '../email/newsletter-email.queue';
import { PrismaService } from '../prisma/prisma.service';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';

function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === 'P2002'
  );
}

@Injectable()
export class NewsletterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly emailQueue: NewsletterEmailQueue,
  ) {}

  async subscribe(dto: SubscribeNewsletterDto) {
    const subscriber = await this.create(dto);
    await this.emailQueue.enqueue(subscriber.email);
    return subscriber;
  }

  private async create(dto: SubscribeNewsletterDto) {
    try {
      return await this.prisma.newsletterSubscriber.create({
        data: { email: dto.email },
      });
    } catch (err: unknown) {
      if (isPrismaUniqueConstraintError(err)) {
        throw new ConflictException('This email is already subscribed.');
      }
      throw err;
    }
  }

  listAdmin() {
    return this.prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Subscriber not found');
    }

    await this.prisma.newsletterSubscriber.delete({ where: { id } });

    await this.auditLog.record({
      actorId,
      action: 'delete_newsletter_subscriber',
      targetType: 'newsletter_subscriber',
      targetId: id,
    });

    return { deleted: true };
  }
}
