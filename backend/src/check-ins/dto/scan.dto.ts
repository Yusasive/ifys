import { IsOptional, IsString, MinLength } from 'class-validator';

export class ScanDto {
  @IsOptional()
  @IsString()
  qrToken?: string;

  @IsOptional()
  @IsString()
  shortCode?: string;

  // Check-in from the name/email search results.
  @IsOptional()
  @IsString()
  ticketId?: string;

  @IsString()
  @MinLength(1)
  stationId!: string;
}
