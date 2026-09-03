import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateQrSecret, generateTicketCode } from './ticket-code';

const MAX_CODE_COLLISION_RETRIES = 5;

function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === 'P2002'
  );
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Idempotent: safe to call more than once for the same registration
  // (duplicate webhook fires, admin mark-paid retried, concurrent calls
  // racing each other). Ticket.registrationId is a DB-level unique
  // constraint — that's the actual single-issuance guarantee, not this
  // function's early-return check, which is just an optimization to skip
  // an unnecessary round-trip on the common case.
  async issueTicketForRegistration(registrationId: string) {
    const existing = await this.prisma.ticket.findUnique({
      where: { registrationId },
    });
    if (existing) {
      return existing;
    }

    return this.generateUniqueCodePair(
      async (ticketCode, qrSecret) => {
        const [ticket] = await this.prisma.$transaction([
          this.prisma.ticket.create({
            data: {
              registrationId,
              ticketCode,
              qrSecret,
              status: 'unused',
            },
          }),
          this.prisma.registration.update({
            where: { id: registrationId },
            data: { status: 'paid' },
          }),
        ]);
        return ticket;
      },
      () => this.prisma.ticket.findUnique({ where: { registrationId } }),
    );
  }

  // Mints a brand-new ticketCode/qrSecret for an already-issued ticket,
  // invalidating the old one (a stale printed/screenshotted copy of the
  // previous code+QR simply won't match this row anymore). Used by
  // AdminService.reissueTicket — e.g. a lost or compromised ticket.
  async reissueTicket(ticketId: string) {
    return this.generateUniqueCodePair(
      (ticketCode, qrSecret) =>
        this.prisma.ticket.update({
          where: { id: ticketId },
          data: { ticketCode, qrSecret },
        }),
      // No race-winner fallback here (unlike issueTicketForRegistration) —
      // a ticketCode collision can only mean two reissues of two different
      // tickets picked the same random code, never two reissues of this
      // same ticket (there's nothing to "win" against), so a genuine
      // unique-constraint hit here is always retry-worthy.
      undefined,
    );
  }

  // Shared by issueTicketForRegistration (create) and reissueTicket
  // (update) — both need "keep generating a fresh code/QR pair until one
  // doesn't collide," they just differ in what write they attempt with it.
  private async generateUniqueCodePair<T>(
    attempt: (ticketCode: string, qrSecret: string) => Promise<T>,
    onCollisionCheckRaceWinner?: () => Promise<T | null>,
  ): Promise<T> {
    for (let i = 0; i < MAX_CODE_COLLISION_RETRIES; i++) {
      try {
        return await attempt(generateTicketCode(), generateQrSecret());
      } catch (err: unknown) {
        if (isPrismaUniqueConstraintError(err)) {
          if (onCollisionCheckRaceWinner) {
            const raceWinner = await onCollisionCheckRaceWinner();
            if (raceWinner) {
              return raceWinner;
            }
          }
          this.logger.warn(
            `Ticket code collision on attempt ${i + 1}, retrying`,
          );
          continue;
        }
        throw err;
      }
    }

    throw new Error(
      `Failed to generate a unique ticket code after ${MAX_CODE_COLLISION_RETRIES} attempts`,
    );
  }
}
