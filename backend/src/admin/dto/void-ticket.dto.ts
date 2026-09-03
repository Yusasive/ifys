import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class VoidTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  // TRD §10: short-lived sessions plus a re-auth step for destructive
  // actions — void is the hardest to reverse of the three manual actions,
  // so it's the one that requires re-entering the current password.
  @IsString()
  @MinLength(1)
  password!: string;
}
