import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ChangeAttendeeEmailDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  // e.g. "original address bounces — buyer confirmed new one on WhatsApp".
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
