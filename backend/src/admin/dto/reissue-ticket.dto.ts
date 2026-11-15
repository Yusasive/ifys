import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReissueTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
