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

  @IsDateString()
  scannedAt!: string;
}

export class SyncDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QueuedScanDto)
  scans!: QueuedScanDto[];
}
