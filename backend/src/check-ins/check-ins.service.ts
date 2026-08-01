import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScanDto } from './dto/scan.dto';

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

@Injectable()
export class CheckInsService {
  constructor(private readonly prisma: PrismaService) {}

  async scan(dto: ScanDto, checkedInBy: string): Promise<ScanResult> {
    const hasQr = !!dto.qrToken;
    const hasCode = !!dto.shortCode;
    if (hasQr === hasCode) {
      throw new BadRequestException(
        'Provide exactly one of qrToken or shortCode',
      );
    }

    const ticket = dto.qrToken
      ? await this.prisma.ticket.findUnique({
          where: { qrSecret: dto.qrToken },
          include: {
            registration: { include: { attendee: true, ticketProduct: true } },
          },
        })
      : await this.prisma.ticket.findUnique({
          where: { ticketCode: dto.shortCode!.trim().toUpperCase() },
          include: {
            registration: { include: { attendee: true, ticketProduct: true } },
          },
        });

    // Deliberately one flat "not found" for any unrecognized code — never
    // hint whether a short code is "close" to real, which would help
    // someone brute-force toward a valid one.
    if (!ticket) {
      return { result: 'not_found' };
    }

    // Personal data (email/phone) never leaves this method — door staff
    // get exactly enough to visually confirm the right person (TRD §10).
    const attendee: AttendeeSummary = {
      fullName: ticket.registration.attendee.fullName,
      category: ticket.registration.ticketProduct.category,
      tier: ticket.registration.ticketProduct.tier,
    };

    if (ticket.status === 'void') {
      return { result: 'void', attendee };
    }

    // Atomic claim, re-verified here rather than trusting ticket.status
    // read moments earlier — this is the actual single-use enforcement.
    // A race between two stations scanning the same code resolves to
    // exactly one row affected; the loser falls through to the
    // already-used branch below (TRD §5, §11 priority 2).
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
        method: dto.qrToken ? 'qr' : 'manual_code',
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
}
