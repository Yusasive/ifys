import {
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { FEEDBACK_ROLES, type FeedbackRole } from '../feedback-form';

export class CreateFeedbackDto {
  @IsString()
  eventSlug!: string;

  @IsIn(FEEDBACK_ROLES)
  role!: FeedbackRole;

  // Checked question-by-question against the form in validateAnswers().
  @IsObject()
  answers!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  consent?: string;

  // Feedback is anonymous unless the person chooses to add these.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // Honeypot: hidden from people, so only bots fill it in.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
