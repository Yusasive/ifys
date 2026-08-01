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

    for (let attempt = 0; attempt < MAX_CODE_COLLISION_RETRIES; attempt++) {
      try {
        const [ticket] = await this.prisma.$transaction([
          this.prisma.ticket.create({
            data: {
              registrationId,
              ticketCode: generateTicketCode(),
              qrSecret: generateQrSecret(),
              status: 'unused',
            },
          }),
          this.prisma.registration.update({
            where: { id: registrationId },
            data: { status: 'paid' },
          }),
        ]);
        return ticket;
      } catch (err: unknown) {
        if (isPrismaUniqueConstraintError(err)) {
          // Either the ticketCode collided (retry with a new one) or a
          // concurrent call already issued a ticket for this registration
          // (registrationId is also unique) — in the latter case, return
          // the winner's ticket instead of erroring.
          const raceWinner = await this.prisma.ticket.findUnique({
            where: { registrationId },
          });
          if (raceWinner) {
            return raceWinner;
          }
          this.logger.warn(
            `Ticket code collision on attempt ${attempt + 1} for registration ${registrationId}, retrying`,
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
