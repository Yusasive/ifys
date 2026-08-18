import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectVolunteerApplicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
