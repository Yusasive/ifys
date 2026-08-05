import {
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Category, Tier } from '../../generated/prisma/enums';

const PHONE_PATTERN = /^\+?[0-9\s-]{7,15}$/;

export class CreateRegistrationDto {
  @IsString()
  eventSlug!: string;

  @IsEnum(Category)
  category!: Category;

  @IsEnum(Tier)
  tier!: Tier;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  phone!: string;

  @IsObject()
  formData!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  couponCode?: string;
}
