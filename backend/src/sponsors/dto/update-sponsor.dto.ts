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

export class UpdateSponsorDto {
  @IsOptional()
  @IsEnum(SponsorType)
  type?: SponsorType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

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
