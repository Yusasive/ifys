import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelRegistrationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
