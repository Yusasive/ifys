import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class WithdrawTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  // Same re-auth requirement as VoidTicketDto — withdrawing ends in the
  // same void state, revoking access, so it's just as destructive.
  @IsString()
  @MinLength(1)
  password!: string;
}
