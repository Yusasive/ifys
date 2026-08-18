import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelRegistrationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  // Same re-auth requirement as VoidTicketDto — cancelling a pending
  // registration is destructive and not reversible from the dashboard.
  @IsString()
  @IsNotEmpty()
  password!: string;
}
