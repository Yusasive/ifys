import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { VOLUNTEER_TEAMS } from '../../email/labels';

const YES_NO_MAYBE = ['yes', 'no', 'maybe'] as const;
const OCCUPATIONAL_STATUSES = [
  'student',
  'employed',
  'self_employed',
  'entrepreneur',
  'unemployed',
  'other',
] as const;

export class CreateVolunteerApplicationDto {
  @IsString()
  eventSlug!: string;

  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsString()
  @MinLength(1)
  phone!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  location!: string;

  @IsIn(YES_NO_MAYBE)
  willingToTravel!: string;

  @IsIn(OCCUPATIONAL_STATUSES)
  occupationalStatus!: string;

  @IsOptional()
  @IsString()
  occupationalStatusOther?: string;

  @IsString()
  @MinLength(1)
  aboutYourself!: string;

  @IsBoolean()
  volunteeredBefore!: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  volunteeredAreas?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  skills!: string[];

  @IsOptional()
  @IsString()
  skillsOther?: string;

  @IsIn(VOLUNTEER_TEAMS)
  team!: string;

  @IsString()
  @MinLength(1)
  whyVolunteer!: string;

  @IsIn(YES_NO_MAYBE)
  availabilityCommitment!: string;

  @IsString()
  @MinLength(1)
  timeCommitment!: string;

  @IsOptional()
  @IsString()
  additionalComments?: string;
}
