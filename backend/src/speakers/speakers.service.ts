import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateSpeakerDto } from './dto/create-speaker.dto';
import { ListSpeakersQueryDto } from './dto/list-speakers.query';
import { SpeakerPhotoUploadUrlDto } from './dto/speaker-photo-upload-url.dto';
import { UpdateSpeakerDto } from './dto/update-speaker.dto';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class SpeakersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly auditLog: AuditLogService,
  ) {}

  // Appends -2, -3, ... on collision (same name reused, or two names that
  // slugify to the same value) so the slug stays unique and readable.
  private async generateUniqueSlug(
    name: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugify(name) || 'speaker';
    let slug = base;
    let suffix = 2;
    while (
      await this.prisma.speaker.findFirst({
        where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      })
    ) {
      slug = `${base}-${suffix++}`;
    }
    return slug;
  }

  private async withPhotoUrls<T extends { photoKey: string | null }>(
    speakers: T[],
  ): Promise<(T & { photoUrl: string | null })[]> {
    return Promise.all(
      speakers.map(async (speaker) => ({
        ...speaker,
        photoUrl: speaker.photoKey
          ? await this.storage.getDownloadUrl(speaker.photoKey)
          : null,
      })),
    );
  }

  async listPublic(eventSlug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
      include: {
        speakers: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${eventSlug}"`);
    }
    return {
      event: {
        id: event.id,
        name: event.name,
        venue: event.venue,
        startsAt: event.startsAt,
        slug: event.slug,
      },
      speakers: await this.withPhotoUrls(event.speakers),
    };
  }

  async getPublicBySlug(slug: string) {
    const speaker = await this.prisma.speaker.findUnique({ where: { slug } });
    if (!speaker || !speaker.isActive) {
      throw new NotFoundException('Speaker not found');
    }
    const [withUrl] = await this.withPhotoUrls([speaker]);
    return withUrl;
  }

  async listAdmin(eventSlug: string, query: ListSpeakersQueryDto) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${eventSlug}"`);
    }

    const [total, speakers] = await this.prisma.$transaction([
      this.prisma.speaker.count({ where: { eventId: event.id } }),
      this.prisma.speaker.findMany({
        where: { eventId: event.id },
        orderBy: { displayOrder: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      speakers: await this.withPhotoUrls(speakers),
    };
  }

  async create(dto: CreateSpeakerDto, actorId: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug: dto.eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${dto.eventSlug}"`);
    }

    const speaker = await this.prisma.speaker.create({
      data: {
        eventId: event.id,
        name: dto.name,
        slug: await this.generateUniqueSlug(dto.name),
        role: dto.role,
        tag: dto.tag ?? 'Speaker',
        bio: dto.bio,
        photoKey: dto.photoKey,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'create_speaker',
      targetType: 'speaker',
      targetId: speaker.id,
    });

    return speaker;
  }

  async update(id: string, dto: UpdateSpeakerDto, actorId: string) {
    const existing = await this.prisma.speaker.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Speaker not found');
    }

    const speaker = await this.prisma.speaker.update({
      where: { id },
      data: {
        name: dto.name,
        // Re-derive the slug whenever the name changes, so it never drifts
        // out of sync with what's displayed; existing links to the old
        // slug will 404, but this is an admin-managed lineup, not
        // long-lived user content.
        slug:
          dto.name && dto.name !== existing.name
            ? await this.generateUniqueSlug(dto.name, id)
            : undefined,
        role: dto.role,
        tag: dto.tag,
        bio: dto.bio,
        photoKey: dto.photoKey,
        displayOrder: dto.displayOrder,
        isActive: dto.isActive,
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'update_speaker',
      targetType: 'speaker',
      targetId: speaker.id,
    });

    return speaker;
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.speaker.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Speaker not found');
    }

    await this.prisma.speaker.delete({ where: { id } });

    await this.auditLog.record({
      actorId,
      action: 'delete_speaker',
      targetType: 'speaker',
      targetId: id,
    });

    return { deleted: true };
  }

  async createPhotoUploadUrl(dto: SpeakerPhotoUploadUrlDto) {
    const extension = dto.fileName.split('.').pop() ?? 'bin';
    const key = `speakers/${randomUUID()}.${extension}`;
    const uploadUrl = await this.storage.getUploadUrl(key, dto.contentType);
    return { key, uploadUrl };
  }
}
