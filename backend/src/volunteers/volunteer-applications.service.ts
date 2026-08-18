import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditLogService } from '../audit-log/audit-log.service';
import { VolunteerApplicationEmailQueue } from '../email/volunteer-application-email.queue';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVolunteerApplicationDto } from './dto/create-volunteer-application.dto';
import { ListVolunteerApplicationsQueryDto } from './dto/list-volunteer-applications.query';

@Injectable()
export class VolunteerApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly emailQueue: VolunteerApplicationEmailQueue,
  ) {}

  async listAdmin(eventSlug: string, query: ListVolunteerApplicationsQueryDto) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${eventSlug}"`);
    }

    const where = {
      eventId: event.id,
      ...(query.status && { status: query.status }),
    };

    const [total, applications] = await this.prisma.$transaction([
      this.prisma.volunteerApplication.count({ where }),
      this.prisma.volunteerApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { total, page: query.page, pageSize: query.pageSize, applications };
  }

  async getStatus(eventSlug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
      select: { volunteerApplicationsPaused: true },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${eventSlug}"`);
    }
    return { paused: event.volunteerApplicationsPaused };
  }

  async create(dto: CreateVolunteerApplicationDto) {
    const event = await this.prisma.event.findUnique({
      where: { slug: dto.eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${dto.eventSlug}"`);
    }
    if (event.volunteerApplicationsPaused) {
      throw new BadRequestException(
        'Volunteer applications are not currently open',
      );
    }

    const application = await this.prisma.volunteerApplication.create({
      data: {
        eventId: event.id,
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        formDataJson: {
          location: dto.location,
          willingToTravel: dto.willingToTravel,
          occupationalStatus: dto.occupationalStatus,
          occupationalStatusOther: dto.occupationalStatusOther,
          aboutYourself: dto.aboutYourself,
          volunteeredBefore: dto.volunteeredBefore,
          volunteeredAreas: dto.volunteeredAreas,
          skills: dto.skills,
          skillsOther: dto.skillsOther,
          team: dto.team,
          whyVolunteer: dto.whyVolunteer,
          availabilityCommitment: dto.availabilityCommitment,
          timeCommitment: dto.timeCommitment,
          additionalComments: dto.additionalComments,
        },
        status: 'pending',
      },
    });

    await this.emailQueue.enqueue(application.id, 'received');

    return application;
  }

  async approve(id: string, actorId: string, reason?: string) {
    const application = await this.prisma.volunteerApplication.findUnique({
      where: { id },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const updated = await this.prisma.volunteerApplication.update({
      where: { id },
      data: { status: 'approved', reviewedAt: new Date() },
    });

    await this.auditLog.record({
      actorId,
      action: 'approve_volunteer_application',
      targetType: 'volunteer_application',
      targetId: id,
      metadata: reason ? { reason } : {},
    });

    await this.emailQueue.enqueue(id, 'approved', reason);

    return updated;
  }

  async reject(id: string, actorId: string, reason: string) {
    const application = await this.prisma.volunteerApplication.findUnique({
      where: { id },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const updated = await this.prisma.volunteerApplication.update({
      where: { id },
      data: { status: 'rejected', reviewedAt: new Date() },
    });

    await this.auditLog.record({
      actorId,
      action: 'reject_volunteer_application',
      targetType: 'volunteer_application',
      targetId: id,
      metadata: reason ? { reason } : {},
    });

    await this.emailQueue.enqueue(id, 'rejected', reason);

    return updated;
  }

  async bulkApprove(ids: string[], actorId: string, reason?: string) {
    const results = await Promise.allSettled(
      ids.map((id) => this.approve(id, actorId, reason)),
    );
    return this.summarizeBulkResults(ids, results);
  }

  async bulkReject(ids: string[], actorId: string, reason: string) {
    const results = await Promise.allSettled(
      ids.map((id) => this.reject(id, actorId, reason)),
    );
    return this.summarizeBulkResults(ids, results);
  }

  private summarizeBulkResults(
    ids: string[],
    results: PromiseSettledResult<unknown>[],
  ): { succeeded: string[]; failed: { id: string; error: string }[] } {
    const succeeded: string[] = [];
    const failed: { id: string; error: string }[] = [];
    results.forEach((result, index) => {
      const id = ids[index];
      if (result.status === 'fulfilled') {
        succeeded.push(id);
      } else {
        const error =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        failed.push({ id, error });
      }
    });
    return { succeeded, failed };
  }
}
