import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import { SponsorType } from '../../generated/prisma/enums';

export class CreateSponsorDto {
  @IsString()
  eventSlug!: string;

  @IsEnum(SponsorType)
  type!: SponsorType;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  logoKey?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
