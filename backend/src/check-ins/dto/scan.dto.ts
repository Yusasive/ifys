import { IsOptional, IsString, MinLength } from 'class-validator';

export class ScanDto {
  @IsOptional()
  @IsString()
  qrToken?: string;

  @IsOptional()
  @IsString()
  shortCode?: string;

  @IsString()
  @MinLength(1)
  stationId!: string;
}
