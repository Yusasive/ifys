import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { SponsorLogoUploadUrlDto } from './dto/sponsor-logo-upload-url.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';

@Injectable()
export class SponsorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async withLogoUrls<T extends { logoKey: string | null }>(
    sponsors: T[],
  ): Promise<(T & { logoUrl: string | null })[]> {
    return Promise.all(
      sponsors.map(async (sponsor) => ({
        ...sponsor,
        logoUrl: sponsor.logoKey
          ? await this.storage.getDownloadUrl(sponsor.logoKey)
          : null,
      })),
    );
  }

  async listPublic(eventSlug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
      include: {
        sponsors: {
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
      sponsors: await this.withLogoUrls(event.sponsors),
    };
  }

  async listAdmin(eventSlug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
      include: {
        sponsors: { orderBy: { displayOrder: 'asc' } },
      },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${eventSlug}"`);
    }
    return { sponsors: await this.withLogoUrls(event.sponsors) };
  }

  async create(dto: CreateSponsorDto, actorId: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug: dto.eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${dto.eventSlug}"`);
    }

    const sponsor = await this.prisma.sponsor.create({
      data: {
        eventId: event.id,
        type: dto.type,
        name: dto.name,
        websiteUrl: dto.websiteUrl,
        logoKey: dto.logoKey,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'create_sponsor',
      targetType: 'sponsor',
      targetId: sponsor.id,
    });

    return sponsor;
  }

  async update(id: string, dto: UpdateSponsorDto, actorId: string) {
    const existing = await this.prisma.sponsor.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Sponsor not found');
    }

    const sponsor = await this.prisma.sponsor.update({
      where: { id },
      data: {
        type: dto.type,
        name: dto.name,
        websiteUrl: dto.websiteUrl,
        logoKey: dto.logoKey,
        displayOrder: dto.displayOrder,
        isActive: dto.isActive,
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'update_sponsor',
      targetType: 'sponsor',
      targetId: sponsor.id,
    });

    return sponsor;
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.sponsor.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Sponsor not found');
    }

    await this.prisma.sponsor.delete({ where: { id } });

    await this.auditLog.record({
      actorId,
      action: 'delete_sponsor',
      targetType: 'sponsor',
      targetId: id,
    });

    return { deleted: true };
  }

  async createLogoUploadUrl(dto: SponsorLogoUploadUrlDto) {
    const extension = dto.fileName.split('.').pop() ?? 'bin';
    const key = `sponsors/${randomUUID()}.${extension}`;
    const uploadUrl = await this.storage.getUploadUrl(key, dto.contentType);
    return { key, uploadUrl };
  }
}
