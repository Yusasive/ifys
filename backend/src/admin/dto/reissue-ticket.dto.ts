import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReissueTicketDto {
  // e.g. "lost original", "QR code compromised" — no password re-auth
  // (reissuing moves the ticket toward a valid state, it doesn't revoke
  // access, unlike void/withdraw).
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
