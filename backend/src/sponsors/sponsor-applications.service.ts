import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { SponsorApplicationEmailQueue } from '../email/sponsor-application-email.queue';
import { SponsorApplicationStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateSponsorApplicationDto } from './dto/create-sponsor-application.dto';
import { SponsorApplicationUploadUrlDto } from './dto/sponsor-application-upload-url.dto';

@Injectable()
export class SponsorApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly auditLog: AuditLogService,
    private readonly emailQueue: SponsorApplicationEmailQueue,
  ) {}

  async listAdmin(eventSlug: string, status?: SponsorApplicationStatus) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
      include: {
        sponsorApplications: {
          where: status ? { status } : undefined,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${eventSlug}"`);
    }

    return {
      applications: await Promise.all(
        event.sponsorApplications.map(async (application) => ({
          ...application,
          logoUrl: application.logoKey
            ? await this.storage.getDownloadUrl(application.logoKey)
            : null,
        })),
      ),
    };
  }

  async create(dto: CreateSponsorApplicationDto) {
    const event = await this.prisma.event.findUnique({
      where: { slug: dto.eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${dto.eventSlug}"`);
    }

    const application = await this.prisma.sponsorApplication.create({
      data: {
        eventId: event.id,
        type: dto.type,
        organizationName: dto.organizationName,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
        websiteUrl: dto.websiteUrl,
        budgetNote: dto.budgetNote,
        message: dto.message,
        logoKey: dto.logoKey,
        status: 'pending',
      },
    });

    await this.emailQueue.enqueue(application.id, 'received');

    return application;
  }

  async createUploadUrl(dto: SponsorApplicationUploadUrlDto) {
    const extension = dto.fileName.split('.').pop() ?? 'bin';
    const key = `sponsor-applications/${randomUUID()}.${extension}`;
    const uploadUrl = await this.storage.getUploadUrl(key, dto.contentType);
    return { key, uploadUrl };
  }

  async approve(id: string, actorId: string) {
    const application = await this.prisma.sponsorApplication.findUnique({
      where: { id },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const sponsor = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sponsor.create({
        data: {
          eventId: application.eventId,
          type: application.type,
          name: application.organizationName,
          logoKey: application.logoKey,
          isActive: true,
          displayOrder: 0,
        },
      });
      await tx.sponsorApplication.update({
        where: { id },
        data: {
          status: 'approved',
          reviewedAt: new Date(),
          sponsorId: created.id,
        },
      });
      return created;
    });

    await this.auditLog.record({
      actorId,
      action: 'approve_sponsor_application',
      targetType: 'sponsor_application',
      targetId: id,
      metadata: { sponsorId: sponsor.id },
    });

    await this.emailQueue.enqueue(id, 'approved');

    return sponsor;
  }

  async reject(id: string, actorId: string) {
    const application = await this.prisma.sponsorApplication.findUnique({
      where: { id },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const updated = await this.prisma.sponsorApplication.update({
      where: { id },
      data: { status: 'rejected', reviewedAt: new Date() },
    });

    await this.auditLog.record({
      actorId,
      action: 'reject_sponsor_application',
      targetType: 'sponsor_application',
      targetId: id,
    });

    await this.emailQueue.enqueue(id, 'rejected');

    return updated;
  }
}
