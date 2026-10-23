import { IsEmail, IsString, MaxLength } from 'class-validator';

export class UnsubscribeDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(100)
  token!: string;
}
