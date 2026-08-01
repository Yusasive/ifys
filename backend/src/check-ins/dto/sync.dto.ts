import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class QueuedScanDto {
  @IsString()
  @MinLength(1)
  clientScanId!: string;

  @IsOptional()
  @IsString()
  qrToken?: string;

  @IsOptional()
  @IsString()
  shortCode?: string;

  @IsString()
  @MinLength(1)
  stationId!: string;

  // Client device clock — used only as the historical record of when the
  // physical scan happened, never as the authority for who wins a
  // conflict (that's server arrival order, since device clocks can't be
  // trusted for fairness). See CheckInsService.syncOne.
  @IsDateString()
  scannedAt!: string;
}

export class SyncDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QueuedScanDto)
  scans!: QueuedScanDto[];
}
