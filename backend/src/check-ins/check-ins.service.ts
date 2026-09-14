import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScanDto } from './dto/scan.dto';
import { QueuedScanDto } from './dto/sync.dto';
import { sha256Hex } from './hash';

export interface AttendeeSummary {
  fullName: string;
  category: string;
  tier: string;
}

export type ScanResult =
  | { result: 'not_found' }
  | { result: 'void'; attendee: AttendeeSummary }
  | {
      result: 'already_used';
      attendee: AttendeeSummary;
      firstUsedAt: Date;
      firstUsedStation: string;
    }
  | { result: 'valid_first_use'; attendee: AttendeeSummary };

export type SyncScanResult =
  | { clientScanId: string; result: 'already_synced' }
  | { clientScanId: string; result: 'not_found' }
  | { clientScanId: string; result: 'void'; attendee: AttendeeSummary }
  | {
      clientScanId: string;
      result: 'sync_conflict';
      attendee: AttendeeSummary;
      firstUsedAt: Date;
      firstUsedStation: string;
    }
  | {
      clientScanId: string;
      result: 'valid_first_use';
      attendee: AttendeeSummary;
    };

export interface OfflineIndexEntry {
  codeHash: string;
  qrHash: string;
  status: string;
  attendee: AttendeeSummary;
}

function findTicketByLookup(
  qrToken: string | undefined,
  shortCode: string | undefined,
) {
  const hasQr = !!qrToken;
  const hasCode = !!shortCode;
  if (hasQr === hasCode) {
    throw new BadRequestException(
      'Provide exactly one of qrToken or shortCode',
    );
  }
  return { qrToken, shortCode: shortCode?.trim().toUpperCase() };
}

@Injectable()
export class CheckInsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async scan(dto: ScanDto, checkedInBy: string): Promise<ScanResult> {
    const { qrToken, shortCode } = findTicketByLookup(
      dto.qrToken,
      dto.shortCode,
    );

    const ticket = qrToken
      ? await this.prisma.ticket.findUnique({
          where: { qrSecret: qrToken },
          include: {
            registration: { include: { attendee: true, ticketProduct: true } },
          },
        })
      : await this.prisma.ticket.findUnique({
          where: { ticketCode: shortCode },
          include: {
            registration: { include: { attendee: true, ticketProduct: true } },
          },
        });

    if (!ticket) {
      return { result: 'not_found' };
    }

    const attendee: AttendeeSummary = {
      fullName: ticket.registration.attendee.fullName,
      category: ticket.registration.ticketProduct.category,
      tier: ticket.registration.ticketProduct.tier,
    };

    if (ticket.status === 'void') {
      return { result: 'void', attendee };
    }

    const claim = await this.prisma.ticket.updateMany({
      where: { id: ticket.id, status: 'unused' },
      data: { status: 'used' },
    });

    if (claim.count === 0) {
      const firstCheckIn = await this.prisma.checkIn.findFirst({
        where: { ticketId: ticket.id },
        orderBy: { checkedInAt: 'asc' },
      });
      return {
        result: 'already_used',
        attendee,
        firstUsedAt: firstCheckIn?.checkedInAt ?? ticket.issuedAt,
        firstUsedStation: firstCheckIn?.stationId ?? 'unknown',
      };
    }

    await this.prisma.checkIn.create({
      data: {
        ticketId: ticket.id,
        stationId: dto.stationId,
        checkedInBy,
        method: qrToken ? 'qr' : 'manual_code',
      },
    });

    return { result: 'valid_first_use', attendee };
  }

  async getStatus() {
    const [checkedIn, totalTickets] = await Promise.all([
      this.prisma.ticket.count({ where: { status: 'used' } }),
      this.prisma.ticket.count(),
    ]);
    return { checkedIn, totalTickets };
  }

  async getOfflineIndex(): Promise<OfflineIndexEntry[]> {
    const tickets = await this.prisma.ticket.findMany({
      include: {
        registration: { include: { attendee: true, ticketProduct: true } },
      },
    });

    return tickets.map((ticket) => ({
      codeHash: sha256Hex(ticket.ticketCode),
      qrHash: sha256Hex(ticket.qrSecret),
      status: ticket.status,
      attendee: {
        fullName: ticket.registration.attendee.fullName,
        category: ticket.registration.ticketProduct.category,
        tier: ticket.registration.ticketProduct.tier,
      },
    }));
  }

  async sync(
    items: QueuedScanDto[],
    checkedInBy: string,
  ): Promise<SyncScanResult[]> {
    const results: SyncScanResult[] = [];

    for (const item of items) {
      results.push(await this.syncOne(item, checkedInBy));
    }
    return results;
  }

  private async syncOne(
    item: QueuedScanDto,
    checkedInBy: string,
  ): Promise<SyncScanResult> {
    const { qrToken, shortCode } = findTicketByLookup(
      item.qrToken,
      item.shortCode,
    );

    const existing = await this.prisma.checkIn.findUnique({
      where: { clientScanId: item.clientScanId },
    });
    if (existing) {
      return { clientScanId: item.clientScanId, result: 'already_synced' };
    }

    const ticket = qrToken
      ? await this.prisma.ticket.findUnique({
          where: { qrSecret: qrToken },
          include: {
            registration: { include: { attendee: true, ticketProduct: true } },
          },
        })
      : await this.prisma.ticket.findUnique({
          where: { ticketCode: shortCode },
          include: {
            registration: { include: { attendee: true, ticketProduct: true } },
          },
        });

    if (!ticket) {
      return { clientScanId: item.clientScanId, result: 'not_found' };
    }

    const attendee: AttendeeSummary = {
      fullName: ticket.registration.attendee.fullName,
      category: ticket.registration.ticketProduct.category,
      tier: ticket.registration.ticketProduct.tier,
    };

    if (ticket.status === 'void') {
      return { clientScanId: item.clientScanId, result: 'void', attendee };
    }

    const claim = await this.prisma.ticket.updateMany({
      where: { id: ticket.id, status: 'unused' },
      data: { status: 'used' },
    });

    if (claim.count === 0) {
      await this.auditLog.record({
        actorId: checkedInBy,
        action: 'offline_sync_conflict',
        targetType: 'ticket',
        targetId: ticket.id,
        metadata: {
          clientScanId: item.clientScanId,
          stationId: item.stationId,
          scannedAt: item.scannedAt,
        },
      });
      const firstCheckIn = await this.prisma.checkIn.findFirst({
        where: { ticketId: ticket.id },
        orderBy: { checkedInAt: 'asc' },
      });
      return {
        clientScanId: item.clientScanId,
        result: 'sync_conflict',
        attendee,
        firstUsedAt: firstCheckIn?.checkedInAt ?? ticket.issuedAt,
        firstUsedStation: firstCheckIn?.stationId ?? 'unknown',
      };
    }

    await this.prisma.checkIn.create({
      data: {
        ticketId: ticket.id,
        stationId: item.stationId,
        checkedInBy,
        method: qrToken ? 'qr' : 'manual_code',
        checkedInAt: new Date(item.scannedAt),
        clientScanId: item.clientScanId,
      },
    });

    return {
      clientScanId: item.clientScanId,
      result: 'valid_first_use',
      attendee,
    };
  }
}
