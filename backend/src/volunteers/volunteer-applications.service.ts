import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditLogService } from '../audit-log/audit-log.service';
import { VolunteerApplicationEmailQueue } from '../email/volunteer-application-email.queue';
import { VolunteerApplicationStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVolunteerApplicationDto } from './dto/create-volunteer-application.dto';

@Injectable()
export class VolunteerApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly emailQueue: VolunteerApplicationEmailQueue,
  ) {}

  async listAdmin(eventSlug: string, status?: VolunteerApplicationStatus) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
      include: {
        volunteerApplications: {
          where: status ? { status } : undefined,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${eventSlug}"`);
    }

    return { applications: event.volunteerApplications };
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

  async approve(id: string, actorId: string) {
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
    });

    await this.emailQueue.enqueue(id, 'approved');

    return updated;
  }

  async reject(id: string, actorId: string) {
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
    });

    await this.emailQueue.enqueue(id, 'rejected');

    return updated;
  }
}
