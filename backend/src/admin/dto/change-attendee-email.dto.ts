import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ChangeAttendeeEmailDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
