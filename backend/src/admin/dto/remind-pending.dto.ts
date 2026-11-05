import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class RemindPendingDto {
  // Only registrations pending at least this long are reminded.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 30)
  olderThanHours?: number;
}
