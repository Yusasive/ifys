import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateTicketProductDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  priceKobo?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  discountPercent?: number | null;

  @IsOptional()
  @IsDateString()
  discountExpiresAt?: string | null;

  @IsOptional()
  @IsString()
  cardPriceLabel?: string | null;

  @IsOptional()
  @IsString()
  cardNote?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
