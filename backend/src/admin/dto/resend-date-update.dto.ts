import { IsString, MinLength } from 'class-validator';

export class ResendDateUpdateDto {
  // Emails every ticket holder at once, so it asks for the current password
  // again, same as the other hard-to-undo admin actions.
  @IsString()
  @MinLength(1)
  password!: string;
}
