import {
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
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

  // Analysis fields (all optional, so an older client still registers).
  @IsOptional()
  @IsString()
  @MaxLength(60)
  heardFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ageRange?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  attendReason?: string;

  // First-touch campaign tracking from the sign-up link.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  referrer?: string;
}
