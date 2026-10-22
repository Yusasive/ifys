import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Category } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommitteeMemberDto } from './dto/create-committee-member.dto';
import { CreateCommitteePositionDto } from './dto/create-committee-position.dto';
import { UpdateCommitteeMemberDto } from './dto/update-committee-member.dto';
import { UpdateCommitteePositionDto } from './dto/update-committee-position.dto';

// One printed name sticker. `label` is the role group used for filtering
// on the admin page ("Speaker", "Media Team", ...); `title`/`organization`
// are the smaller lines printed under the name.
export interface NameTag {
  id: string;
  name: string;
  label: string;
  title: string | null;
  organization: string | null;
}

// Short enough for a badge band — CATEGORY_LABELS' long professional
// label ("Professional / Founders / Entrepreneurs") doesn't fit.
const REGISTRANT_TAG_LABELS: Record<Category, string> = {
  student: 'Student',
  regular: 'Attendee',
  founder: 'Professional',
  professional: 'Professional',
};

function formString(data: unknown, key: string): string | null {
  if (!data || typeof data !== 'object') return null;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async findEvent(eventSlug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${eventSlug}"`);
    }
    return event;
  }

  // Built from live data on every request rather than stored, so a new
  // ticket, an approved student, a speaker added on the Speakers page or a
  // corrected name shows up on the next load with nothing to sync.
  async listTags(eventSlug: string) {
    const event = await this.findEvent(eventSlug);

    const [members, registrations, speakers, sponsors] = await Promise.all([
      this.prisma.committeeMember.findMany({
        where: { eventId: event.id },
        include: { position: true },
        orderBy: [
          { position: { displayOrder: 'asc' } },
          { position: { name: 'asc' } },
          { fullName: 'asc' },
        ],
      }),
      // "Confirmed" = paid with a live ticket. Students still awaiting ID
      // review (pending_review) have no ticket yet and are left out until
      // approved; voided tickets are left out too.
      this.prisma.registration.findMany({
        where: {
          eventId: event.id,
          status: 'paid',
          ticket: { status: { not: 'void' } },
        },
        include: { attendee: true, ticketProduct: true },
        orderBy: { attendee: { fullName: 'asc' } },
      }),
      this.prisma.speaker.findMany({
        where: { eventId: event.id, isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.sponsor.findMany({
        where: {
          eventId: event.id,
          isActive: true,
          type: { in: ['sponsor', 'partner'] },
        },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
    ]);

    const committee: NameTag[] = members.map((member) => ({
      id: member.id,
      name: member.fullName,
      label: member.position.name,
      // The sticker has no band, so the position also goes on the role line.
      title: member.position.name,
      organization: 'Organising Committee',
    }));

    const registrants: NameTag[] = registrations.map((registration) => {
      const { category } = registration.ticketProduct;
      const form = registration.formDataJson;
      return {
        id: registration.id,
        name: registration.attendee.fullName,
        label: REGISTRANT_TAG_LABELS[category],
        title:
          category === 'student'
            ? formString(form, 'institution')
            : formString(form, 'role'),
        organization:
          category === 'student'
            ? null
            : category === 'founder'
              ? formString(form, 'startupName')
              : formString(form, 'organization'),
      };
    });

    return {
      committee,
      registrants,
      speakers: speakers.map((speaker): NameTag => ({
        id: speaker.id,
        name: speaker.name,
        label: speaker.tag || 'Speaker',
        title: speaker.role,
        organization: null,
      })),
      sponsors: sponsors.map((sponsor): NameTag => ({
        id: sponsor.id,
        name: sponsor.name,
        label: sponsor.type === 'partner' ? 'Partner' : 'Sponsor',
        title: null,
        organization: null,
      })),
    };
  }

  async listCommittee(eventSlug: string) {
    const event = await this.findEvent(eventSlug);
    const [positions, members] = await this.prisma.$transaction([
      this.prisma.committeePosition.findMany({
        where: { eventId: event.id },
        include: { _count: { select: { members: true } } },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.committeeMember.findMany({
        where: { eventId: event.id },
        include: { position: true },
        orderBy: { fullName: 'asc' },
      }),
    ]);
    return {
      positions: positions.map(({ _count, ...position }) => ({
        ...position,
        memberCount: _count.members,
      })),
      members,
    };
  }

  private async assertPositionNameFree(
    eventId: string,
    name: string,
    excludeId?: string,
  ) {
    const clash = await this.prisma.committeePosition.findFirst({
      where: {
        eventId,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (clash) {
      throw new ConflictException(`A position named "${name}" already exists.`);
    }
  }

  async createPosition(dto: CreateCommitteePositionDto, actorId: string) {
    const event = await this.findEvent(dto.eventSlug);
    const name = dto.name.trim();
    await this.assertPositionNameFree(event.id, name);

    const position = await this.prisma.committeePosition.create({
      data: {
        eventId: event.id,
        name,
        displayOrder: dto.displayOrder ?? 0,
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'create_committee_position',
      targetType: 'committee_position',
      targetId: position.id,
    });

    return position;
  }

  async updatePosition(
    id: string,
    dto: UpdateCommitteePositionDto,
    actorId: string,
  ) {
    const existing = await this.prisma.committeePosition.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Position not found');
    }
    const name = dto.name?.trim();
    if (name) {
      await this.assertPositionNameFree(existing.eventId, name, id);
    }

    const position = await this.prisma.committeePosition.update({
      where: { id },
      data: { name, displayOrder: dto.displayOrder },
    });

    await this.auditLog.record({
      actorId,
      action: 'update_committee_position',
      targetType: 'committee_position',
      targetId: id,
    });

    return position;
  }

  async removePosition(id: string, actorId: string) {
    const existing = await this.prisma.committeePosition.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Position not found');
    }
    if (existing._count.members > 0) {
      throw new BadRequestException(
        `"${existing.name}" still has ${existing._count.members} member(s). Move or remove them first.`,
      );
    }

    await this.prisma.committeePosition.delete({ where: { id } });

    await this.auditLog.record({
      actorId,
      action: 'delete_committee_position',
      targetType: 'committee_position',
      targetId: id,
    });

    return { deleted: true };
  }

  private async findPositionInEvent(positionId: string, eventId: string) {
    const position = await this.prisma.committeePosition.findUnique({
      where: { id: positionId },
    });
    if (!position || position.eventId !== eventId) {
      throw new BadRequestException('Unknown position for this event.');
    }
    return position;
  }

  async createMember(dto: CreateCommitteeMemberDto, actorId: string) {
    const event = await this.findEvent(dto.eventSlug);
    await this.findPositionInEvent(dto.positionId, event.id);

    const member = await this.prisma.committeeMember.create({
      data: {
        eventId: event.id,
        fullName: dto.fullName.trim(),
        positionId: dto.positionId,
      },
      include: { position: true },
    });

    await this.auditLog.record({
      actorId,
      action: 'create_committee_member',
      targetType: 'committee_member',
      targetId: member.id,
    });

    return member;
  }

  async updateMember(
    id: string,
    dto: UpdateCommitteeMemberDto,
    actorId: string,
  ) {
    const existing = await this.prisma.committeeMember.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Committee member not found');
    }
    if (dto.positionId) {
      await this.findPositionInEvent(dto.positionId, existing.eventId);
    }

    const member = await this.prisma.committeeMember.update({
      where: { id },
      data: { fullName: dto.fullName?.trim(), positionId: dto.positionId },
      include: { position: true },
    });

    await this.auditLog.record({
      actorId,
      action: 'update_committee_member',
      targetType: 'committee_member',
      targetId: id,
    });

    return member;
  }

  async removeMember(id: string, actorId: string) {
    const existing = await this.prisma.committeeMember.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Committee member not found');
    }

    await this.prisma.committeeMember.delete({ where: { id } });

    await this.auditLog.record({
      actorId,
      action: 'delete_committee_member',
      targetType: 'committee_member',
      targetId: id,
    });

    return { deleted: true };
  }
}
