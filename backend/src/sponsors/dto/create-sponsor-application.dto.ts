import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { SponsorType } from '../../generated/prisma/enums';

export class CreateSponsorApplicationDto {
  @IsString()
  eventSlug!: string;

  @IsEnum(SponsorType)
  type!: SponsorType;

  @IsString()
  @MinLength(1)
  organizationName!: string;

  @IsString()
  @MinLength(1)
  contactName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  logoKey?: string;
}
