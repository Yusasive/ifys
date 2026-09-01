import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateEventSettingsDto {
  @IsOptional()
  @IsBoolean()
  ticketPurchasingPaused?: boolean;

  @IsOptional()
  @IsBoolean()
  volunteerApplicationsPaused?: boolean;

  @IsOptional()
  @IsBoolean()
  sponsorshipApplicationsPaused?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  ticketCapacity?: number;
}
