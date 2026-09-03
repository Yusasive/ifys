import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class MarkPaidDto {
  // Admin-internal bookkeeping (e.g. "cash received at the door", "bank
  // transfer confirmed manually") — kept in the audit log, never echoed
  // into the attendee's confirmation email.
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
