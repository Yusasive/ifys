import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SendTestCertificateDto {
  @IsEmail()
  email!: string;

  // The name printed on the sample; defaults to a placeholder.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;
}
