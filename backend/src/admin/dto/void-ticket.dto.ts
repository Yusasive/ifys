import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class VoidTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
