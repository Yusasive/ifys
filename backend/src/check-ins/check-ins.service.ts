import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { Category } from '../generated/prisma/enums';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScanDto } from './dto/scan.dto';
import { QueuedScanDto } from './dto/sync.dto';
import { sha256Hex } from './hash';
import { registrantTagLines } from '../tags/tag-details';

export interface AttendeeSummary {
  fullName: string;
  category: string;
  tier: string;
  // The role/institution and organisation lines printed on their name tag,
  // so door staff can pick out the right tag.
  title: string | null;
  organization: string | null;
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
  | { result: 'valid_first_use'; ticketId: string; attendee: AttendeeSummary };

export type SyncScanResult =
  | { clientScanId: string; result: 'already_synced' }
  | { clientScanId: string; result: 'invalid'; reason: string }
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
  // Lets the device drop a ticket's old hashes when it is reissued.
  ticketId: string;
  codeHash: string;
  qrHash: string;
  status: string;
  attendee: AttendeeSummary;
}

export interface CheckInStatusGroup {
  category: string;
  tier: string;
  checkedIn: number;
  total: number;
}

export interface CheckInStatus {
  checkedIn: number;
  totalTickets: number;
  groups: CheckInStatusGroup[];
}

export interface TicketSearchHit {
  ticketId: string;
  status: string;
  maskedEmail: string;
  attendee: AttendeeSummary;
}

const UNDO_WINDOW_MS = 2 * 60_000;

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

export interface OfflineIndexResponse {
  entries: OfflineIndexEntry[];
  // Pass back as `updatedSince` on the next call.
  syncedAt: string;
  // True when entries is the whole list (no `updatedSince` was given), so
  // the device should replace its copy instead of merging.
  full: boolean;
}

const DELTA_OVERLAP_MS = 5000;

function findTicketByLookup(
  qrToken: string | undefined,
  shortCode: string | undefined,
  ticketId?: string,
) {
  const provided = [qrToken, shortCode, ticketId].filter(Boolean).length;
  if (provided !== 1) {
    throw new BadRequestException(
      'Provide exactly one of qrToken, shortCode or ticketId',
    );
  }
  return { qrToken, shortCode: shortCode?.trim().toUpperCase(), ticketId };
}

const TICKET_INCLUDE = {
  registration: { include: { attendee: true, ticketProduct: true } },
} as const;

type TicketWithAttendee = NonNullable<
  Awaited<ReturnType<CheckInsService['findTicket']>>
>;

function summarizeRegistration(registration: {
  attendee: { fullName: string };
  ticketProduct: { category: Category; tier: string };
  formDataJson: unknown;
}): AttendeeSummary {
  const { category, tier } = registration.ticketProduct;
  return {
    fullName: registration.attendee.fullName,
    category,
    tier,
    ...registrantTagLines(category, registration.formDataJson),
  };
}

function summarize(ticket: TicketWithAttendee): AttendeeSummary {
  return summarizeRegistration(ticket.registration);
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'P2002'
  );
}

@Injectable()
export class CheckInsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findTicket(
    qrToken: string | undefined,
    shortCode: string | undefined,
    ticketId?: string,
  ) {
    if (qrToken) {
      return this.prisma.ticket.findUnique({
        where: { qrSecret: qrToken },
        include: TICKET_INCLUDE,
      });
    }
    if (ticketId) {
      return this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: TICKET_INCLUDE,
      });
    }
    return this.prisma.ticket.findUnique({
      where: { ticketCode: shortCode },
      include: TICKET_INCLUDE,
    });
  }

  private claimAndRecord(
    ticketId: string,
    checkIn: Prisma.CheckInUncheckedCreateWithoutTicketInput,
  ): Promise<boolean> {
    return this.prisma
      .$transaction(async (tx) => {
        const claim = await tx.ticket.updateMany({
          where: { id: ticketId, status: 'unused' },
          data: { status: 'used' },
        });
        if (claim.count === 0) return false;
        await tx.checkIn.create({ data: { ticketId, ...checkIn } });
        return true;
      })
      .then((claimed) => {
        // Counts changed; don't serve a stale status for the next few seconds.
        if (claimed) this.statusCache = null;
        return claimed;
      });
  }

  private async firstCheckIn(ticket: TicketWithAttendee) {
    const first = await this.prisma.checkIn.findFirst({
      where: { ticketId: ticket.id },
      orderBy: { checkedInAt: 'asc' },
    });
    return {
      firstUsedAt: first?.checkedInAt ?? ticket.issuedAt,
      firstUsedStation: first?.stationId ?? 'unknown',
    };
  }

  async scan(dto: ScanDto, checkedInBy: string): Promise<ScanResult> {
    const { qrToken, shortCode, ticketId } = findTicketByLookup(
      dto.qrToken,
      dto.shortCode,
      dto.ticketId,
    );

    const ticket = await this.findTicket(qrToken, shortCode, ticketId);
    if (!ticket) {
      return { result: 'not_found' };
    }

    const attendee = summarize(ticket);
    if (ticket.status === 'void') {
      return { result: 'void', attendee };
    }

    const claimed = await this.claimAndRecord(ticket.id, {
      stationId: dto.stationId,
      checkedInBy,
      method: qrToken ? 'qr' : 'manual_code',
    });
    if (!claimed) {
      return {
        result: 'already_used',
        attendee,
        ...(await this.firstCheckIn(ticket)),
      };
    }

    return { result: 'valid_first_use', ticketId: ticket.id, attendee };
  }

  // Polled by every door device every few seconds, so the result is cached
  // briefly instead of re-reading all tickets each time.
  private statusCache: { at: number; value: CheckInStatus } | null = null;

  async getStatus(): Promise<CheckInStatus> {
    if (this.statusCache && Date.now() - this.statusCache.at < 3000) {
      return this.statusCache.value;
    }
    // Void tickets can't enter, so they count toward neither side.
    const tickets = await this.prisma.ticket.findMany({
      where: { status: { not: 'void' } },
      select: {
        status: true,
        registration: {
          select: {
            ticketProduct: { select: { category: true, tier: true } },
          },
        },
      },
    });

    const groups = new Map<string, CheckInStatusGroup>();
    let checkedIn = 0;
    for (const t of tickets) {
      const { category, tier } = t.registration.ticketProduct;
      const key = `${category}:${tier}`;
      const group = groups.get(key) ?? {
        category,
        tier,
        checkedIn: 0,
        total: 0,
      };
      group.total += 1;
      if (t.status === 'used') {
        group.checkedIn += 1;
        checkedIn += 1;
      }
      groups.set(key, group);
    }

    const value: CheckInStatus = {
      checkedIn,
      totalTickets: tickets.length,
      groups: [...groups.values()].sort(
        (a, b) =>
          a.category.localeCompare(b.category) || a.tier.localeCompare(b.tier),
      ),
    };
    this.statusCache = { at: Date.now(), value };
    return value;
  }

  // Name/email lookup for guests who forgot their ticket. Emails are partly
  // masked: staff need enough to tell two namesakes apart, not the address.
  async search(query: string): Promise<TicketSearchHit[]> {
    const q = query.trim();
    if (q.length < 3) {
      throw new BadRequestException('Type at least 3 characters to search');
    }
    const tickets = await this.prisma.ticket.findMany({
      where: {
        registration: {
          attendee: {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      },
      take: 10,
      orderBy: { issuedAt: 'asc' },
      include: TICKET_INCLUDE,
    });
    return tickets.map((t) => ({
      ticketId: t.id,
      status: t.status,
      maskedEmail: maskEmail(t.registration.attendee.email),
      attendee: summarize(t),
    }));
  }

  // Reverses an accidental check-in. Only allowed shortly afterwards: later
  // than that it's a real admission someone should review, not a mis-tap.
  async undo(ticketId: string, actorId: string): Promise<{ ok: true }> {
    const last = await this.prisma.checkIn.findFirst({
      where: { ticketId },
      orderBy: { checkedInAt: 'desc' },
    });
    if (!last) {
      throw new ConflictException('This ticket has not been checked in');
    }
    if (Date.now() - last.checkedInAt.getTime() > UNDO_WINDOW_MS) {
      throw new ConflictException(
        'Too long ago to undo here — ask an organizer.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.checkIn.delete({ where: { id: last.id } }),
      this.prisma.ticket.updateMany({
        where: { id: ticketId, status: 'used' },
        data: { status: 'unused' },
      }),
    ]);
    await this.auditLog.record({
      actorId,
      action: 'undo_check_in',
      targetType: 'ticket',
      targetId: ticketId,
      metadata: { stationId: last.stationId, checkedInBy: last.checkedInBy },
    });
    this.statusCache = null;
    return { ok: true };
  }

  async getOfflineIndex(updatedSince?: Date): Promise<OfflineIndexResponse> {
    // Captured before the query so nothing changing mid-query is skipped.
    const syncedAt = new Date();
    const tickets = await this.prisma.ticket.findMany({
      where: updatedSince
        ? {
            updatedAt: {
              gte: new Date(updatedSince.getTime() - DELTA_OVERLAP_MS),
            },
          }
        : undefined,
      select: {
        id: true,
        ticketCode: true,
        qrSecret: true,
        status: true,
        registration: {
          select: {
            attendee: { select: { fullName: true } },
            ticketProduct: { select: { category: true, tier: true } },
            formDataJson: true,
          },
        },
      },
    });

    return {
      entries: tickets.map((ticket) => ({
        ticketId: ticket.id,
        codeHash: sha256Hex(ticket.ticketCode),
        qrHash: sha256Hex(ticket.qrSecret),
        status: ticket.status,
        attendee: summarizeRegistration(ticket.registration),
      })),
      syncedAt: syncedAt.toISOString(),
      full: !updatedSince,
    };
  }

  async sync(
    items: QueuedScanDto[],
    checkedInBy: string,
  ): Promise<SyncScanResult[]> {
    const results: SyncScanResult[] = [];

    // One bad item must not fail the whole batch (the client would retry it
    // forever), so every item gets its own result.
    for (const item of items) {
      try {
        results.push(await this.syncOne(item, checkedInBy));
      } catch (err) {
        if (err instanceof BadRequestException) {
          results.push({
            clientScanId: item.clientScanId,
            result: 'invalid',
            reason: err.message,
          });
          continue;
        }
        throw err;
      }
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

    const ticket = await this.findTicket(qrToken, shortCode);
    if (!ticket) {
      return { clientScanId: item.clientScanId, result: 'not_found' };
    }

    const attendee = summarize(ticket);
    if (ticket.status === 'void') {
      return { clientScanId: item.clientScanId, result: 'void', attendee };
    }

    let claimed: boolean;
    try {
      claimed = await this.claimAndRecord(ticket.id, {
        stationId: item.stationId,
        checkedInBy,
        method: qrToken ? 'qr' : 'manual_code',
        checkedInAt: new Date(item.scannedAt),
        clientScanId: item.clientScanId,
      });
    } catch (err) {
      // A concurrent retry of the same queued scan won the insert.
      if (isUniqueViolation(err)) {
        return { clientScanId: item.clientScanId, result: 'already_synced' };
      }
      throw err;
    }

    if (!claimed) {
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
      return {
        clientScanId: item.clientScanId,
        result: 'sync_conflict',
        attendee,
        ...(await this.firstCheckIn(ticket)),
      };
    }

    return {
      clientScanId: item.clientScanId,
      result: 'valid_first_use',
      attendee,
    };
  }
}
