import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RestoreTicketDto {
  // e.g. "voided in error" — no password re-auth (un-voiding moves the
  // ticket toward a valid state, it doesn't revoke access).
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
