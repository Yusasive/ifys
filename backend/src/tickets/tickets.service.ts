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

  async reissueTicket(ticketId: string) {
    return this.generateUniqueCodePair(
      (ticketCode, qrSecret) =>
        this.prisma.ticket.update({
          where: { id: ticketId },
          data: { ticketCode, qrSecret },
        }),

      undefined,
    );
  }

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
