import { IsBoolean, IsOptional } from 'class-validator';

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
}
